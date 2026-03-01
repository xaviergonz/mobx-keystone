import type { ModelPropTransform } from "../../modelShared/prop"
import { lazy } from "../../utils"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type {
  AnyStandardType,
  AnyType,
  CodecType,
  TypeToData,
  TypeToSnapshotIn,
  TypeToSnapshotOut,
} from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import type { TypeToStoredData } from "./typeToStoredData"

export interface RuntimeAdapter<Stored, Runtime> {
  toRuntime(stored: Stored, setStored?: (stored: Stored) => void): Runtime
  toStored(runtime: Runtime): Stored
  toStoredIfCached(runtime: Runtime): { found: true; value: Stored } | { found: false }
}

export interface ResolvedCodecSupport {
  hasCodec: boolean
  storedType: AnyStandardType
  adapter: RuntimeAdapter<any, any>
}

interface CodecMetadata {
  readonly typeName: string
  readonly encodedType: AnyType
  readonly is: (value: unknown) => boolean
  readonly transform: ModelPropTransform<unknown, unknown>
}

type CodecConfig<TEncodedType extends AnyType, TRuntime> = {
  typeName: string
  encodedType: TEncodedType
  is(value: unknown): value is TRuntime
} & ModelPropTransform<TypeToData<TEncodedType>, TRuntime>

export type CodecFromEncoded<TEncodedType extends AnyType, TRuntime> = CodecType<
  TRuntime,
  TypeToSnapshotIn<TEncodedType>,
  TypeToSnapshotOut<TEncodedType>,
  TypeToStoredData<TEncodedType>
>

const codecMetadataByType = new WeakMap<AnyStandardType, CodecMetadata>()

export const identityRuntimeAdapter: RuntimeAdapter<any, any> = {
  toRuntime(stored) {
    return stored
  },

  toStored(runtime) {
    return runtime
  },

  toStoredIfCached(runtime) {
    return {
      found: true,
      value: runtime,
    }
  },
}

/**
 * `types.codec` type info.
 */
export class CodecTypeInfo extends TypeInfo {
  readonly kind = "codec"

  get encodedTypeInfo(): TypeInfo {
    return getTypeInfo(this.encodedType)
  }

  constructor(
    thisType: AnyStandardType,
    readonly typeName: string,
    readonly encodedType: AnyStandardType
  ) {
    super(thisType)
  }
}

function setCodecMetadata(type: AnyStandardType, metadata: CodecMetadata) {
  codecMetadataByType.set(type, metadata)
}

export function getCodecMetadata(type: AnyStandardType) {
  return codecMetadataByType.get(type)
}

export function createCodecType<TEncodedType extends AnyType, TRuntime>(
  { typeName, encodedType, is, transform, untransform }: CodecConfig<TEncodedType, TRuntime>,
  baseType: TypeCheckerBaseType
): CodecFromEncoded<TEncodedType, TRuntime> {
  const resolvedEncodedType = lazy(() => resolveStandardType(encodedType))
  const typeInfoGen: TypeInfoGen = (t) => new CodecTypeInfo(t, typeName, resolvedEncodedType())
  const codecMetadata: CodecMetadata = {
    typeName,
    encodedType,
    is,
    transform: { transform, untransform },
  }

  const codecType = lateTypeChecker(() => {
    const encodedTypeChecker = resolveTypeChecker(encodedType)

    const thisTc: TypeChecker = new TypeChecker(
      baseType,

      (value, path, typeCheckedValue) => {
        if (!is(value)) {
          return new TypeCheckError({
            path,
            expectedTypeName: typeName,
            actualValue: value,
            typeCheckedValue,
          })
        }

        return encodedTypeChecker.check(
          untransform({
            transformedValue: value as TRuntime,
            cacheTransformedValue: () => {},
          }) as TypeToData<TEncodedType>,
          path,
          typeCheckedValue
        )
      },

      () => typeName,
      typeInfoGen,

      (value) => (is(value) ? thisTc : null),

      (snapshot) => {
        const processedSnapshot = encodedTypeChecker.fromSnapshotProcessor(snapshot)
        return transform({
          originalValue: processedSnapshot as TypeToData<TEncodedType>,
          cachedTransformedValue: undefined,
          setOriginalValue: () => {},
        })
      },

      (value) => {
        const storedValue = untransform({
          transformedValue: value as TRuntime,
          cacheTransformedValue: () => {},
        })

        return encodedTypeChecker.toSnapshotProcessor(storedValue)
      }
    )

    setCodecMetadata(thisTc as unknown as AnyStandardType, codecMetadata)

    return thisTc
  }, typeInfoGen) as unknown as AnyStandardType

  setCodecMetadata(codecType, codecMetadata)

  return codecType as any
}

export function typesCodec<TEncodedType extends AnyType, TRuntime>(
  config: CodecConfig<TEncodedType, TRuntime>
): CodecFromEncoded<TEncodedType, TRuntime> {
  return createCodecType(config, TypeCheckerBaseType.Any)
}
