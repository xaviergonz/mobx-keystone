import { failure } from "../utils"
import { AnyType, TypeToData } from "./schemas"
import { resolveTypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * Checks if a value conforms to a given type.
 *
 * @typename S Type.
 * @param type Type to check for.
 * @param value Value to check.
 * @returns A TypeError if the check fails or null if no error.
 */
export function typeCheck<T extends AnyType>(type: T, value: TypeToData<T>): TypeCheckError | null {
  if (!type) {
    throw failure("a type must be passed")
  }
  const typeChecker = resolveTypeChecker(type)

  if (typeChecker.unchecked) {
    return null
  } else {
    return typeChecker.check(value, [])
  }
}
