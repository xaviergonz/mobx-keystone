import { isArray } from "../utils"
import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import { AnyStandardType, AnyType, ArrayType } from "./schemas"
import { getTypeInfo, lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents an array of values of a given type.
 *
 * Example:
 * ```ts
 * const numberArrayType = types.array(types.number)
 * ```
 *
 * @typeparam T Item type.
 * @param itemType Type of inner items.
 * @returns
 */
export function typesArray<T extends AnyType>(itemType: T): ArrayType<T> {
  const typeInfoGen: TypeInfoGen = t => new ArrayTypeInfo(t, resolveStandardType(itemType))

  return lateTypeChecker(() => {
    const itemChecker = resolveTypeChecker(itemType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `Array<${itemChecker.getTypeName(...recursiveTypeCheckers, itemChecker)}>`

    const thisTc: TypeChecker = new TypeChecker(
      (array, path) => {
        if (!isArray(array)) {
          return new TypeCheckError(path, getTypeName(thisTc), array)
        }

        if (!itemChecker.unchecked) {
          for (let i = 0; i < array.length; i++) {
            const itemError = itemChecker.check(array[i], [...path, i])
            if (itemError) {
              return itemError
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
 * `types.array` type info.
 */
export class ArrayTypeInfo extends TypeInfo {
  get itemTypeInfo(): TypeInfo {
    return getTypeInfo(this.itemType)
  }

  constructor(thisType: AnyStandardType, readonly itemType: AnyStandardType) {
    super(thisType)
  }
}
