import type { Path } from "../../parent/pathTypes"
import { isArray } from "../../utils"
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
 * A type that represents an array of values of a given type.
 *
 * Example:
 * ```ts
 * const numberArrayType = types.array(types.number)
 * ```
 *
 * @template T Item type.
 * @param itemType Type of inner items.
 * @returns
 */
export function typesArray<T extends AnyType>(itemType: T): ArrayType<T[]> {
  const resolvedItemType = resolveStandardType(itemType)
  const typeInfoGen: TypeInfoGen = (t) => new ArrayTypeInfo(t, resolvedItemType)
  const typeChecker = lateTypeChecker(() => {
    const itemChecker = resolveTypeChecker(resolvedItemType)
    const emptyChildPath: Path = []

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `Array<${itemChecker.getTypeName(...recursiveTypeCheckers, itemChecker)}>`

    // MobX observable arrays invalidate reads at collection granularity. Per-index
    // computeds would therefore all be invalidated by the same mutation while adding
    // a computed and cache entry per item.
    const checkArrayItems = createWholeContainerCachedCheck((array, path, typeCheckedValue) => {
      for (let index = 0; index < array.length; index++) {
        const error = itemChecker.check(array[index], emptyChildPath, typeCheckedValue)
        if (error) {
          return prependPathElementToTypeCheckError(error, path, index, typeCheckedValue)
        }
      }
      return null
    })

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Array,

      (array, path, typeCheckedValue) => {
        if (!isArray(array)) {
          return new TypeCheckError({
            path,
            expectedTypeName: getTypeName(thisTc),
            actualValue: array,
            typeCheckedValue,
          })
        }

        if (itemChecker.unchecked || itemChecker.skipCheck) {
          return null
        }

        return checkArrayItems(array, path, typeCheckedValue)
      },
      getTypeName,
      typeInfoGen,

      (array) => {
        if (!isArray(array)) {
          return null
        }

        if (!itemChecker.unchecked) {
          for (let i = 0; i < array.length; i++) {
            const itemActualChecker = itemChecker.snapshotType(array[i])
            if (!itemActualChecker) {
              return null
            }
          }
        }

        return thisTc
      },

      snapshotProcessorPlan(
        () => [itemChecker],
        ([itemProcessor]) =>
          itemProcessor
            ? (sn: unknown[]) => {
                return sn.map((item, i) => withErrorPathSegment(i, () => itemProcessor(item)))
              }
            : undefined
      ),

      snapshotProcessorPlan(
        () => [itemChecker],
        ([itemProcessor]) =>
          itemProcessor
            ? (sn: unknown[]) => {
                return sn.map((item, i) => withErrorPathSegment(i, () => itemProcessor(item)))
              }
            : undefined
      )
    )

    return thisTc
  }, typeInfoGen)
  return typeChecker as any
}

/**
 * `types.array` type info.
 */
export class ArrayTypeInfo extends TypeInfo {
  readonly kind = "array"
  readonly itemType: AnyStandardType

  get itemTypeInfo(): TypeInfo {
    return getTypeInfo(this.itemType)
  }

  constructor(thisType: AnyStandardType, itemType: AnyStandardType) {
    super(thisType)
    this.itemType = itemType
  }
}
