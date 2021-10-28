import type { IdentityType } from "../schemas"
import { TypeChecker, TypeCheckerBaseType, TypeInfo } from "../TypeChecker"

const identityFn = (x: any) => x

const unchecked: IdentityType<any> = new TypeChecker(
  TypeCheckerBaseType.Any,
  null,
  () => "any",
  (t) => new UncheckedTypeInfo(t),

  () => unchecked as any,

  identityFn,
  identityFn
) as any

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
export function typesUnchecked<T = never>(): IdentityType<T> {
  return unchecked
}

/**
 * `types.unchecked` type info.
 */
export class UncheckedTypeInfo extends TypeInfo {}
