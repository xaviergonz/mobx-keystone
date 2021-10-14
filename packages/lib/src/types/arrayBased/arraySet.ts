import { getGlobalConfig } from "../../globalConfig/globalConfig"
import { modelTypeKey } from "../../model/metadata"
import { modelInfoByClass } from "../../modelShared/modelInfo"
import { isObject } from "../../utils"
import { ArraySet } from "../../wrappers/ArraySet"
import { getTypeInfo } from "../getTypeInfo"
import { typesObject } from "../objectBased/object"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, IdentityType, TypeToData } from "../schemas"
import {
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { TypeCheckError } from "../TypeCheckError"
import { typesArray } from "./array"

/**
 * A type that represents an array backed set ArraySet.
 *
 * Example:
 * ```ts
 * const numberSetType = types.arraySet(types.number)
 * ```
 *
 * @typeparam T Value type.
 * @param valueType Value type.
 * @returns
 */
export function typesArraySet<T extends AnyType>(
  valueType: T
): IdentityType<ArraySet<TypeToData<T>>> {
  const typeInfoGen: TypeInfoGen = (t) => new ArraySetTypeInfo(t, resolveStandardType(valueType))

  return lateTypeChecker(() => {
    const modelInfo = modelInfoByClass.get(ArraySet)!

    const valueChecker = resolveTypeChecker(valueType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `ArraySet<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const dataTypeChecker = typesObject(() => ({
      items: typesArray(valueChecker as any),
    }))

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object, // because it is really a model

      (obj, path) => {
        if (!(obj instanceof ArraySet)) {
          return new TypeCheckError(path, getTypeName(thisTc), obj)
        }

        const resolvedTc = resolveTypeChecker(dataTypeChecker)
        return resolvedTc.check(obj.$, path)
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

      (sn: { items: unknown[] }) => {
        return {
          ...sn,
          [modelTypeKey]: modelInfo.name,
          items: sn.items.map((v) => valueChecker.fromSnapshotProcessor(v)),
        }
      },

      (sn: { items: unknown[]; [modelTypeKey]?: string }) => {
        const snCopy = {
          ...sn,
          items: sn.items.map((v) => valueChecker.toSnapshotProcessor(v)),
        }

        if (getGlobalConfig().avoidModelTypeInTypedModelSnapshotsIfPossible) {
          delete snCopy[modelTypeKey]
        }

        return snCopy
      }
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.arraySet` type info.
 */
export class ArraySetTypeInfo extends TypeInfo {
  get valueTypeInfo(): TypeInfo {
    return getTypeInfo(this.valueType)
  }

  constructor(originalType: AnyStandardType, readonly valueType: AnyStandardType) {
    super(originalType)
  }
}
