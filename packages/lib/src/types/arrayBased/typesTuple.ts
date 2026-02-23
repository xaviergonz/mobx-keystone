import type { Path } from "../../parent/pathTypes"
import { isArray, lazy } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
import { createPerEntryCachedCheck } from "../createPerEntryCachedCheck"
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
import { prependPathElementToTypeCheckError } from "../typeCheckErrorUtils"

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
    const emptyChildPath: Path = []

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const typeNames = checkers.map((tc) => {
        if (recursiveTypeCheckers.includes(tc)) {
          return "..."
        }
        return tc.getTypeName(...recursiveTypeCheckers, tc)
      })

      return "[" + typeNames.join(", ") + "]"
    }

    // No setupCachePruning needed: tuple length is fixed, so entries never become stale.
    const checkTupleItems = createPerEntryCachedCheck<number>(
      (_array, checkEntry) => {
        for (let i = 0; i < checkers.length; i++) {
          const error = checkEntry(i)
          if (error) return error
        }
        return null
      },
      (array, index, path, typeCheckedValue) => {
        const error = checkers[index].check(array[index], emptyChildPath, typeCheckedValue)
        return error
          ? prependPathElementToTypeCheckError(error, path, index, typeCheckedValue)
          : null
      }
    )

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

        return checkTupleItems(array, path, typeCheckedValue)
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
  readonly kind = "tuple"

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
