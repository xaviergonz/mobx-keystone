import { isArray } from "../utils"
import { AnyType, ArrayType } from "./schemas"
import { lateTypeChecker, resolveTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents an array of values of a given type.
 *
 * @typeparam S Item type.
 * @param itemType Type of inner items.
 * @returns
 */
export function typesArray<T extends AnyType>(itemType: T): ArrayType<T> {
  return lateTypeChecker(() => {
    const itemChecker = resolveTypeChecker(itemType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `Array<${itemChecker.getTypeName(...recursiveTypeCheckers, itemChecker)}>`

    const thisTc: TypeChecker = new TypeChecker((array, path) => {
      if (!isArray(array)) {
        return new TypeCheckError(path, getTypeName(thisTc), array)
      }

      if (itemChecker.check) {
        for (let i = 0; i < array.length; i++) {
          const itemError = itemChecker.check(array[i], [...path, i])
          if (itemError) {
            return itemError
          }
        }
      }

      return null
    }, getTypeName)

    return thisTc
  }) as any
}
