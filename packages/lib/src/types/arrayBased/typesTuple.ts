import type { Path } from "../../parent/pathTypes"
import { isArray, lazy } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
import { createWholeContainerCachedCheck } from "../createCachedTypeCheck"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, ArrayType } from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  lateTypeChecker,
  snapshotProcessorPlan,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  type TypeInfoGen,
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
  const resolvedItemTypes = itemTypes.map(resolveStandardType)
  const typeInfoGen: TypeInfoGen = (t) => new TupleTypeInfo(t, resolvedItemTypes)
  const typeChecker = lateTypeChecker(() => {
    const checkers = resolvedItemTypes.map(resolveTypeChecker)
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

    const checkTupleItemsImperatively = (
      array: unknown[],
      path: Path,
      typeCheckedValue: any
    ): TypeCheckError | null => {
      for (let i = 0; i < checkers.length; i++) {
        const checker = checkers[i]
        if (checker.unchecked || checker.skipCheck) {
          continue
        }
        const error = checker.check(array[i], emptyChildPath, typeCheckedValue)
        if (error) {
          return prependPathElementToTypeCheckError(error, path, i, typeCheckedValue)
        }
      }
      return null
    }

    // MobX observable arrays invalidate reads at collection granularity, so indexed
    // computeds cannot isolate tuple-item changes and only add allocation overhead.
    const checkTupleItems = createWholeContainerCachedCheck(checkTupleItemsImperatively)

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

      snapshotProcessorPlan(
        () => checkers,
        (processors) =>
          processors.some(Boolean)
            ? (array: unknown[]) => {
                return array.map((item, i) => {
                  const processor = processors[i]
                  return processor ? withErrorPathSegment(i, () => processor(item)) : item
                })
              }
            : undefined
      ),

      snapshotProcessorPlan(
        () => checkers,
        (processors) =>
          processors.some(Boolean)
            ? (array: unknown[]) => {
                return array.map((item, i) => {
                  const processor = processors[i]
                  return processor ? withErrorPathSegment(i, () => processor(item)) : item
                })
              }
            : undefined
      )
    )

    return thisTc
  }, typeInfoGen)
  return typeChecker as any
}

/**
 * `types.tuple` type info.
 */
export class TupleTypeInfo extends TypeInfo {
  readonly kind = "tuple"
  readonly itemTypes: ReadonlyArray<AnyStandardType>

  // memoize to always return the same array on the getter
  private _itemTypeInfos = lazy(() => this.itemTypes.map(getTypeInfo))

  get itemTypeInfos(): ReadonlyArray<TypeInfo> {
    return this._itemTypeInfos()
  }

  constructor(thisType: AnyStandardType, itemTypes: ReadonlyArray<AnyStandardType>) {
    super(thisType)
    this.itemTypes = itemTypes
  }
}
