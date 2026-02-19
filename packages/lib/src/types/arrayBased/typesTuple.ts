import { isArray, lazy } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, ArrayType } from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"

/**
 * A type that represents an tuple of values of a given type.
 *
 * Example:
 * ```ts
 * const stringNumberTupleType = types.tuple(types.string, types.number)
 * ```
 *
 * @template T Item types.
 * @param itemTypes Type of inner items.
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
      TypeCheckerBaseType.Array,

      (array, path, typeCheckedValue) => {
        if (!isArray(array) || array.length !== itemTypes.length) {
          return new TypeCheckError({
            path,
            expectedTypeName: getTypeName(thisTc),
            actualValue: array,
            typeCheckedValue,
          })
        }

        for (let i = 0; i < array.length; i++) {
          const itemError = checkers[i].check(array[i], [...path, i], typeCheckedValue)
          if (itemError) {
            return itemError
          }
        }

        return null
      },

      getTypeName,
      typeInfoGen,

      (array) => {
        if (!isArray(array) || array.length !== itemTypes.length) {
          return null
        }

        for (let i = 0; i < array.length; i++) {
          const itemActualChecker = checkers[i].snapshotType(array[i])
          if (!itemActualChecker) {
            return null
          }
        }

        return thisTc
      },

      (array: unknown[]) => {
        return array.map((item, i) => {
          return withErrorPathSegment(i, () => checkers[i].fromSnapshotProcessor(item))
        })
      },

      (array: unknown[]) => {
        return array.map((item, i) => {
          return withErrorPathSegment(i, () => checkers[i].toSnapshotProcessor(item))
        })
      }
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.tuple` type info.
 */
export class TupleTypeInfo extends TypeInfo {
  // memoize to always return the same array on the getter
  private _itemTypeInfos = lazy(() => this.itemTypes.map(getTypeInfo))

  get itemTypeInfos(): ReadonlyArray<TypeInfo> {
    return this._itemTypeInfos()
  }

  constructor(
    thisType: AnyStandardType,
    readonly itemTypes: ReadonlyArray<AnyStandardType>
  ) {
    super(thisType)
  }
}
