import { resolveTypeChecker } from "./resolveTypeChecker"
import { AnyType } from "./schemas"
import { lateTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"
import { typesUnchecked } from "./unchecked"

/**
 * A type that represents the union of several other types (a | b | c | ...).
 *
 * Example:
 * ```ts
 * const booleanOrNumberType = types.or(types.boolean, types.number)
 * ```
 *
 * @typeparam T Type.
 * @param options Possible types.
 * @returns
 */
export function typesOr<T extends AnyType[]>(...options: T): T[number] {
  return lateTypeChecker(() => {
    const checkers = options.map(resolveTypeChecker)

    // if the or includes unchecked then it is unchecked
    if (checkers.some(tc => tc.unchecked)) {
      return typesUnchecked() as any
    }

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const typeNames = checkers.map(tc => {
        if (recursiveTypeCheckers.includes(tc)) {
          return "..."
        }
        return tc.getTypeName(...recursiveTypeCheckers, tc)
      })

      return typeNames.join(" | ")
    }

    const thisTc: TypeChecker = new TypeChecker((value, path) => {
      const noMatchingType = checkers.every(tc => !!tc.check(value, path))
      if (noMatchingType) {
        return new TypeCheckError(path, getTypeName(thisTc), value)
      } else {
        return null
      }
    }, getTypeName)

    return thisTc
  }) as any
}
