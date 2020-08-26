import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import { AnyStandardType, AnyType, TypeToData } from "./schemas"
import { getTypeInfo, lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

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
 * const sumModelType = types.refinement(types.model<Sum>(Sum), (sum) => {
 *   // imagine that for some reason sum includes a number 'a', a number 'b'
 *   // and the result
 *
 *   const rightResult = sum.a + sum.b === sum.result
 *
 *   // simple mode that will just return that the whole model is incorrect
 *   return rightResult
 *
 *   // this will return that the result field is wrong
 *   return rightResult ? null : new TypeCheckError(["result"], "a+b", sum.result)
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
      (data, path) => {
        const baseErr = baseChecker.check(data, path)
        if (baseErr) {
          return baseErr
        }

        const refinementErr = checkFn(data)

        if (refinementErr === true) {
          return null
        } else if (refinementErr === false) {
          return new TypeCheckError([], getTypeName(thisTc), data)
        } else {
          return refinementErr ?? null
        }
      },
      getTypeName,
      typeInfoGen
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
