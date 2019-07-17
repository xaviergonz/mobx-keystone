import { IdentityType } from "./schemas"
import { TypeChecker } from "./TypeChecker"

const unchecked: IdentityType<any> = new TypeChecker(null, () => "any") as any

/**
 * A type that represents a given value that won't be type checked.
 * This is basically a way to bail out of the runtime type checking system.
 *
 * Example:
 * ```ts
 * const uncheckedSomeModel = types.unchecked<SomeModel>()
 * const anyType = types.unchecked<any>()
 * const customUncheckedType = types.unchecked<(A & B) | C>()
 * ```
 *
 * @typeparam T Type of the value, or unkown if not given.
 * @returns
 */
export function typesUnchecked<T = unknown>(): IdentityType<T> {
  return unchecked
}
