import { ArraySet } from "../wrappers/ArraySet"
import { typesArray } from "./array"
import { typesObject } from "./object"
import { resolveTypeChecker } from "./resolveTypeChecker"
import { AnyType, IdentityType, TypeToData } from "./schemas"
import { lateTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents an array backed set ArraySet.
 *
 * Example:
 * ```ts
 * const numberSetType = types.arraySet(types.number)
 * ```
 *
 * @typeparam T Value type.
 * @param values Value type.
 * @returns
 */
export function typesArraySet<T extends AnyType>(values: T): IdentityType<ArraySet<TypeToData<T>>> {
  return lateTypeChecker(() => {
    const valueChecker = resolveTypeChecker(values)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `ArraySet<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const thisTc: TypeChecker = new TypeChecker((obj, path) => {
      if (!(obj instanceof ArraySet)) {
        return new TypeCheckError(path, getTypeName(thisTc), obj)
      }

      const dataTypeChecker = typesObject(() => ({
        items: typesArray(valueChecker as any),
      }))

      const resolvedTc = resolveTypeChecker(dataTypeChecker)
      return resolvedTc.check(obj.$, path)
    }, getTypeName)

    return thisTc
  }) as any
}
