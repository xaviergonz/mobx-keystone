import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, TypeToData } from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import { lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "../TypeChecker"

/**
 * A refinement over a given type. This allows you to do extra checks
 * over models, ensure numbers are integers, etc.
 *
 * Example:
 * ```ts
 * const integerType = types.refinement(types.number, (n) => {
 *   return Number.isInteger(n)
 * }, "integer")
 *
 * const sumModelType = types.refinement(types.model(Sum), (sum) => {
 *   // imagine that for some reason sum includes a number 'a', a number 'b'
 *   // and the result
 *
 *   const rightResult = sum.a + sum.b === sum.result
 *
 *   // simple mode that will just return that the whole model is incorrect
 *   return rightResult
 *
 *   // this will return that the result field is wrong
 *   return rightResult ? null : new TypeCheckError({
 *     path: ["result"],
 *     expectedTypeName: "a+b",
 *     actualValue: sum.result,
 *   })
 * })
 * ```
 *
 * @template T Base type.
 * @param baseType Base type.
 * @param checkFn Function that will receive the data (if it passes the base type
 * check) and return null or false if there were no errors or either a TypeCheckError instance or
 * true if there were.
 * @returns
 */
export function typesRefinement<T extends AnyType>(
  baseType: T,
  checkFn: (data: TypeToData<T>) => TypeCheckError | null | boolean,
  typeName?: string
): T {
  const typeInfoGen: TypeInfoGen = (t) =>
    new RefinementTypeInfo(t, resolveStandardType(baseType), checkFn, typeName)

  return lateTypeChecker(() => {
    const baseChecker = resolveTypeChecker(baseType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const baseTypeName = baseChecker.getTypeName(...recursiveTypeCheckers, baseChecker)
      const refinementName = typeName || "refinementOf"
      return `${refinementName}<${baseTypeName}>`
    }

    const thisTc: TypeChecker = new TypeChecker(
      baseChecker.baseType,

      (data, path, typeCheckedValue) => {
        const baseErr = baseChecker.check(data, path, typeCheckedValue)
        if (baseErr) {
          return baseErr
        }

        const refinementErr = checkFn(data)

        if (refinementErr === true || refinementErr == null) {
          return null
        } else if (refinementErr === false) {
          return new TypeCheckError({
            path,
            expectedTypeName: getTypeName(thisTc),
            actualValue: data,
            typeCheckedValue,
          })
        } else {
          // override typeCheckedValue
          return new TypeCheckError({
            path: refinementErr.path,
            expectedTypeName: refinementErr.expectedTypeName,
            actualValue: refinementErr.actualValue,
            typeCheckedValue,
          })
        }
      },

      getTypeName,
      typeInfoGen,

      // we cannot check refinement here since it checks data instances, not snapshots
      (sn) => baseChecker.snapshotType(sn),

      (sn) => baseChecker.fromSnapshotProcessor(sn),
      (sn) => baseChecker.toSnapshotProcessor(sn)
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.refinement` type info.
 */
export class RefinementTypeInfo extends TypeInfo {
  get baseTypeInfo(): TypeInfo {
    return getTypeInfo(this.baseType)
  }

  constructor(
    thisType: AnyStandardType,
    readonly baseType: AnyStandardType,
    readonly checkFunction: (data: any) => TypeCheckError | null | boolean,
    readonly typeName: string | undefined
  ) {
    super(thisType)
  }
}
