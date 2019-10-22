import { typesOr } from "./or"
import { typesNull, typesUndefined } from "./primitives"
import { AnyType, IdentityType, OrType } from "./schemas"

/**
 * A type that represents either a type or undefined.
 *
 * Example:
 * ```ts
 * const numberOrUndefinedType = types.maybe(types.number)
 * ```
 *
 * @typeparam S Type.
 * @param type Type.
 * @returns
 */
export function typesMaybe<T extends AnyType>(type: T): OrType<[T, IdentityType<undefined>]> {
  return typesOr(type, typesUndefined)
}

/**
 * A type that represents either a type or null.
 *
 *  * Example:
 * ```ts
 * const numberOrNullType = types.maybeNull(types.number)
 * ```
 *
 * @typeparam S Type.
 * @param type Type.
 * @returns
 */
export function typesMaybeNull<T extends AnyType>(type: T): OrType<[T, IdentityType<null>]> {
  return typesOr(type, typesNull)
}
