import { isArray, lateVal } from "../utils"
import { getTypeInfo } from "./getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyStandardType, AnyType, ArrayType } from "./schemas"
import { lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents an tuple of values of a given type.
 *
 * Example:
 * ```ts
 * const stringNumberTupleType = types.tuple(types.string, types.number)
 * ```
 *
 * @typeparam T Item types.
 * @param itemType Type of inner items.
 * @returns
 */
export function typesTuple<T extends AnyType[]>(...itemTypes: T): ArrayType<T> {
  const typeInfoGen: TypeInfoGen = (t) => new TupleTypeInfo(t, itemTypes.map(resolveStandardType))

  return lateTypeChecker(() => {
    const checkers = itemTypes.map(resolveTypeChecker)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const typeNames = checkers.map((tc) => {
        if (recursiveTypeCheckers.includes(tc)) {
          return "..."
        }
        return tc.getTypeName(...recursiveTypeCheckers, tc)
      })

      return "[" + typeNames.join(", ") + "]"
    }

    const thisTc: TypeChecker = new TypeChecker(
      (array, path) => {
        if (!isArray(array) || array.length !== itemTypes.length) {
          return new TypeCheckError(path, getTypeName(thisTc), array)
        }

        for (let i = 0; i < array.length; i++) {
          const itemChecker = checkers[i]
          if (!itemChecker.unchecked) {
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
 * `types.tuple` type info.
 */
export class TupleTypeInfo extends TypeInfo {
  // memoize to always return the same array on the getter
  private _itemTypeInfos = lateVal(() => this.itemTypes.map(getTypeInfo))

  get itemTypeInfos(): ReadonlyArray<TypeInfo> {
    return this._itemTypeInfos()
  }

  constructor(thisType: AnyStandardType, readonly itemTypes: ReadonlyArray<AnyStandardType>) {
    super(thisType)
  }
}
