import { isObject } from "../utils"
import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import { AnyStandardType, AnyType, RecordType } from "./schemas"
import { getTypeInfo, lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

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
  const typeInfoGen: TypeInfoGen = tc => new RecordTypeInfo(tc, resolveStandardType(valueType))

  return lateTypeChecker(() => {
    const valueChecker = resolveTypeChecker(valueType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `Record<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const thisTc: TypeChecker = new TypeChecker(
      (obj, path) => {
        if (!isObject(obj)) return new TypeCheckError(path, getTypeName(thisTc), obj)

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
      typeInfoGen
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
