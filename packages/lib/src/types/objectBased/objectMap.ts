import { getGlobalConfig } from "../../globalConfig/globalConfig"
import { modelTypeKey } from "../../model/metadata"
import { modelInfoByClass } from "../../modelShared/modelInfo"
import { isObject } from "../../utils"
import { ObjectMap } from "../../wrappers/ObjectMap"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, ModelType, TypeToData } from "../schemas"
import {
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { TypeCheckError } from "../TypeCheckError"
import { typesObject } from "./object"
import { typesRecord } from "./record"

/**
 * A type that represents an object-like map ObjectMap.
 *
 * Example:
 * ```ts
 * const numberMapType = types.objectMap(types.number)
 * ```
 *
 * @typeparam T Value type.
 * @param valueType Value type.
 * @returns
 */
export function typesObjectMap<T extends AnyType>(
  valueType: T
): ModelType<ObjectMap<TypeToData<T>>> {
  const typeInfoGen: TypeInfoGen = (t) => new ObjectMapTypeInfo(t, resolveStandardType(valueType))

  return lateTypeChecker(() => {
    const modelInfo = modelInfoByClass.get(ObjectMap)!

    const valueChecker = resolveTypeChecker(valueType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `ObjectMap<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const dataTypeChecker = typesObject(() => ({
      items: typesRecord(valueChecker as any),
    }))
    const resolvedDataTypeChecker = resolveTypeChecker(dataTypeChecker)

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object,

      (obj, path) => {
        if (!(obj instanceof ObjectMap)) {
          return new TypeCheckError(path, getTypeName(thisTc), obj)
        }

        return resolvedDataTypeChecker.check(obj.$, path)
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

        return resolvedDataTypeChecker.snapshotType(obj) ? thisTc : null
      },

      (sn: { items: Record<string, unknown> }) => {
        const newItems: typeof sn["items"] = {}

        for (const k of Object.keys(sn.items)) {
          newItems[k] = valueChecker.fromSnapshotProcessor(sn.items[k])
        }

        return {
          ...sn,
          [modelTypeKey]: modelInfo.name,
          items: newItems,
        }
      },

      (sn: { items: Record<string, unknown>; [modelTypeKey]?: string }) => {
        const newItems: typeof sn["items"] = {}

        for (const k of Object.keys(sn.items)) {
          newItems[k] = valueChecker.toSnapshotProcessor(sn.items[k])
        }

        const snCopy = {
          ...sn,
          items: newItems,
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
 * `types.objectMap` type info.
 */
export class ObjectMapTypeInfo extends TypeInfo {
  get valueTypeInfo(): TypeInfo {
    return getTypeInfo(this.valueType)
  }

  constructor(thisType: AnyStandardType, readonly valueType: AnyStandardType) {
    super(thisType)
  }
}
