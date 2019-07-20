import { isObject } from "../utils"
import { AnyType, ObjectMapType } from "./schemas"
import { lateTypeChecker, resolveTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents an object-like map, an object with string keys and values all of a same given type.
 *
 * Example:
 * ```ts
 * // { [k: string]: number }
 * const numberMapType = types.objectMap(types.number)
 * ```
 *
 * @typeparam T Type.
 * @param values Type of the values of the object-like map.
 * @returns
 */
export function typesObjectMap<T extends AnyType>(values: T): ObjectMapType<T> {
  return lateTypeChecker(() => {
    const valueChecker = resolveTypeChecker(values)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `ObjectMap<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const thisTc: TypeChecker = new TypeChecker((obj, path) => {
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
    }, getTypeName)

    return thisTc
  }) as any
}
