import { typesOr } from "./or"
import { typesNull, typesUndefined } from "./primitives"
import { AnyType } from "./schemas"

/**
 * A type that represents either a type or undefined.
 *
 * @typeparam S Type.
 * @param type Type.
 * @returns
 */
export function typesMaybe<T extends AnyType>(type: T) {
  return typesOr(type, typesUndefined)
}

/**
 * A type that represents either a type or null.
 *
 * @typeparam S Type.
 * @param type Type.
 * @returns
 */
export function typesMaybeNull<T extends AnyType>(type: T) {
  return typesOr(type, typesNull)
}
