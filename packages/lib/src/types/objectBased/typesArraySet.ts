import { modelTypeKey } from "../../model/metadata"
import { modelInfoByClass } from "../../modelShared/modelInfo"
import { isObject } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
import { ArraySet } from "../../wrappers/ArraySet"
import { typesArray } from "../arrayBased/typesArray"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, ModelType, TypeToData } from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  lateTypeChecker,
  snapshotProcessorPlan,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  type TypeInfoGen,
} from "../TypeChecker"
import { resolveCodecSupport } from "../utility/typesCodec"
import { typesObject } from "./typesObject"

/**
 * A type that represents an array backed set ArraySet.
 *
 * Example:
 * ```ts
 * const numberSetType = types.arraySet(types.number)
 * ```
 *
 * @template T Value type.
 * @param valueType Value type.
 * @returns
 */
export function typesArraySet<T extends AnyType>(valueType: T): ModelType<ArraySet<TypeToData<T>>> {
  const resolvedValueType = resolveStandardType(valueType)
  const typeInfoGen: TypeInfoGen = (t) => new ArraySetTypeInfo(t, resolvedValueType)
  return lateTypeChecker(() => {
    const modelInfo = modelInfoByClass.get(ArraySet)!

    const valueChecker = resolveTypeChecker(resolvedValueType)
    const valueSupport = resolveCodecSupport(resolvedValueType)
    const storedValueChecker = resolveTypeChecker(valueSupport.storedType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `ArraySet<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const dataTypeChecker = typesObject(() => ({
      items: typesArray(valueSupport.storedType as any),
    }))

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object, // because it is really a model

      (obj, path, typeCheckedValue) => {
        if (!(obj instanceof ArraySet)) {
          return new TypeCheckError({
            path,
            expectedTypeName: getTypeName(thisTc),
            actualValue: obj,
            typeCheckedValue,
          })
        }

        const resolvedTc = resolveTypeChecker(dataTypeChecker)
        return resolvedTc.check(obj.$, path, typeCheckedValue)
      },

      getTypeName,
      typeInfoGen,

      (obj) => {
        if (!isObject(obj)) {
          return null
        }

        if (obj[modelTypeKey] !== undefined) {
          // fast check
          return obj[modelTypeKey] === modelInfo.name ? thisTc : null
        }

        const resolvedTc = resolveTypeChecker(dataTypeChecker)
        return resolvedTc.snapshotType(obj) ? thisTc : null
      },

      snapshotProcessorPlan(
        () => [storedValueChecker],
        ([itemProcessor]) =>
          (sn: { items: unknown[] }) => {
            const items = itemProcessor
              ? withErrorPathSegment("items", () =>
                  sn.items.map((v, i) => withErrorPathSegment(i, () => itemProcessor(v)))
                )
              : sn.items

            return {
              ...sn,
              [modelTypeKey]: modelInfo.name,
              items,
            }
          },
        true
      ),

      snapshotProcessorPlan(
        () => [storedValueChecker],
        ([itemProcessor]) =>
          itemProcessor
            ? (sn: { items: unknown[]; [modelTypeKey]?: string }) => {
                const items = withErrorPathSegment("items", () =>
                  sn.items.map((v, i) => withErrorPathSegment(i, () => itemProcessor(v)))
                )

                const snCopy = {
                  ...sn,
                  items,
                }

                return snCopy
              }
            : undefined
      )
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.arraySet` type info.
 */
export class ArraySetTypeInfo extends TypeInfo {
  readonly kind = "arraySet"
  readonly valueType: AnyStandardType

  get valueTypeInfo(): TypeInfo {
    return getTypeInfo(this.valueType)
  }

  constructor(originalType: AnyStandardType, valueType: AnyStandardType) {
    super(originalType)
    this.valueType = valueType
  }
}
