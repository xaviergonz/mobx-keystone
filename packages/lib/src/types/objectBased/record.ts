import { isObject } from "../../utils"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, RecordType } from "../schemas"
import {
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { TypeCheckError } from "../TypeCheckError"

/**
 * A type that represents an object-like map, an object with string keys and values all of a same given type.
 *
 * Example:
 * ```ts
 * // { [k: string]: number }
 * const numberMapType = types.record(types.number)
 * ```
 *
 * @typeparam T Type.
 * @param valueType Type of the values of the object-like map.
 * @returns
 */
export function typesRecord<T extends AnyType>(valueType: T): RecordType<T> {
  const typeInfoGen: TypeInfoGen = (tc) => new RecordTypeInfo(tc, resolveStandardType(valueType))

  return lateTypeChecker(() => {
    const valueChecker = resolveTypeChecker(valueType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `Record<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const applySnapshotProcessor = (obj: Record<string, unknown>, mode: "from" | "to") => {
      if (valueChecker.unchecked) {
        return obj
      }

      const newObj: typeof obj = {}

      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const v =
          mode === "from"
            ? valueChecker.fromSnapshotProcessor(obj[k])
            : valueChecker.toSnapshotProcessor(obj[k])
        newObj[k] = v
      }

      return newObj
    }

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object,

      (obj, path) => {
        if (!isObject(obj)) {
          return new TypeCheckError(path, getTypeName(thisTc), obj)
        }

        if (!valueChecker.unchecked) {
          const keys = Object.keys(obj)
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            const v = obj[k]
            const valueError = valueChecker.check(v, [...path, k])
            if (valueError) {
              return valueError
            }
          }
        }

        return null
      },

      getTypeName,
      typeInfoGen,

      (obj) => {
        if (!isObject(obj)) return null

        if (!valueChecker.unchecked) {
          const keys = Object.keys(obj)
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            const v = obj[k]
            const valueActualChecker = valueChecker.snapshotType(v)
            if (!valueActualChecker) {
              return null
            }
          }
        }

        return thisTc
      },

      (obj: Record<string, unknown>) => {
        return applySnapshotProcessor(obj, "from")
      },

      (obj: Record<string, unknown>) => {
        return applySnapshotProcessor(obj, "to")
      }
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.record` type info.
 */
export class RecordTypeInfo extends TypeInfo {
  get valueTypeInfo(): TypeInfo {
    return getTypeInfo(this.valueType)
  }

  constructor(thisType: AnyStandardType, readonly valueType: AnyStandardType) {
    super(thisType)
  }
}
