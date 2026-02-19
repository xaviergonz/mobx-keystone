import { isArray } from "../../utils"
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
  const typeInfoGen: TypeInfoGen = (t) => new ArrayTypeInfo(t, resolveStandardType(itemType))

  return lateTypeChecker(() => {
    const itemChecker = resolveTypeChecker(itemType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `Array<${itemChecker.getTypeName(...recursiveTypeCheckers, itemChecker)}>`

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

        if (!itemChecker.unchecked) {
          for (let i = 0; i < array.length; i++) {
            const itemError = itemChecker.check(array[i], [...path, i], typeCheckedValue)
            if (itemError) {
              return itemError
            }
          }
        }

        return null
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

      (sn: unknown[]) => {
        if (itemChecker.unchecked) {
          return sn
        }

        return sn.map((item, i) =>
          withErrorPathSegment(i, () => itemChecker.fromSnapshotProcessor(item))
        )
      },

      (sn: unknown[]) => {
        if (itemChecker.unchecked) {
          return sn
        }

        return sn.map((item, i) =>
          withErrorPathSegment(i, () => itemChecker.toSnapshotProcessor(item))
        )
      }
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

  constructor(
    thisType: AnyStandardType,
    readonly itemType: AnyStandardType
  ) {
    super(thisType)
  }
}
