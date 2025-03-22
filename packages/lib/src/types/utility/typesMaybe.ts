import { typesNull, typesUndefined } from "../primitiveBased/typesPrimitive"
import type { AnyType, IdentityType } from "../schemas"
import { typesOr } from "./typesOr"

/**
 * A type that represents either a type or undefined.
 * Syntactic sugar for `types.or(baseType, types.undefined)`
 *
 * Example:
 * ```ts
 * const numberOrUndefinedType = types.maybe(types.number)
 * ```
 *
 * @template T Type.
 * @param baseType Type.
 * @returns
 */
export function typesMaybe<T extends AnyType>(baseType: T): T | IdentityType<undefined> {
  return typesOr(baseType, typesUndefined)
}

/**
 * A type that represents either a type or null.
 * Syntactic sugar for `types.or(baseType, types.null)`
 *
 *  * Example:
 * ```ts
 * const numberOrNullType = types.maybeNull(types.number)
 * ```
 *
 * @template T Type.
 * @param type Type.
 * @returns
 */
export function typesMaybeNull<T extends AnyType>(type: T): T | IdentityType<null> {
  return typesOr(type, typesNull)
}
