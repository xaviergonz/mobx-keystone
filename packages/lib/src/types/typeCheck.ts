import { resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyType, TypeToData } from "./schemas"
import type { TypeCheckError } from "./TypeCheckError"

/**
 * Checks if a value conforms to a given type.
 *
 * @typeparam T Type.
 * @param type Type to check for.
 * @param value Value to check.
 * @returns A TypeError if the check fails or null if no error.
 */
export function typeCheck<T extends AnyType>(type: T, value: TypeToData<T>): TypeCheckError | null {
  const typeChecker = resolveTypeChecker(type)

  if (typeChecker.unchecked) {
    return null
  } else {
    return typeChecker.check(value, [])
  }
}
