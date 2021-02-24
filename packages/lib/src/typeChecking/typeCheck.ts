import { resolveTypeChecker } from "./resolveTypeChecker"
import { AnyType, TypeToData } from "./schemas"
import { TypeCheckErrors } from "./TypeCheckErrors"

/**
 * Checks if a value conforms to a given type.
 *
 * @typename T Type.
 * @param type Type to check for.
 * @param value Value to check.
 * @returns A `TypeCheckErrors` if the check fails or `null` if no error.
 */
export function typeCheck<T extends AnyType>(
  type: T,
  value: TypeToData<T>
): TypeCheckErrors | null {
  const typeChecker = resolveTypeChecker(type)

  if (typeChecker.unchecked) {
    return null
  } else {
    return typeChecker.check(value, [])
  }
}
