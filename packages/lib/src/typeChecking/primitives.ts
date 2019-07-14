import { assertIsPrimitive } from "../utils"
import { IdentityType } from "./schemas"
import { TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A primitive value.
 */
export type PrimitiveValue = undefined | null | boolean | number | string

/**
 * A type that represents a certain value of a primitive (for example an exact number or string).
 *
 * @typeparam T Literal value type.
 * @param literal Literal value.
 * @returns
 */
export function typesLiteral<T extends PrimitiveValue>(literal: T): IdentityType<T> {
  assertIsPrimitive(literal, "literal")
  let typeName: string
  switch (literal) {
    case undefined:
      typeName = "undefined"
      break
    case null:
      typeName = "null"
      break
    default:
      typeName = JSON.stringify(literal)
      break
  }

  return new TypeChecker(
    (value, path) => (value === literal ? null : new TypeCheckError(path, typeName, value)),
    () => typeName
  ) as any
}

/**
 * A type that represents the value undefined.
 */
export const typesUndefined = typesLiteral(undefined)

/**
 * A type that represents the value null.
 */
export const typesNull = typesLiteral(null)

/**
 * A type that represents a boolean value.
 */
export const typesBoolean = (new TypeChecker(
  (value, path) => (typeof value === "boolean" ? null : new TypeCheckError(path, "boolean", value)),
  () => "boolean"
) as any) as IdentityType<boolean>

/**
 * A type that represents a number value.
 */
export const typesNumber = (new TypeChecker(
  (value, path) => (typeof value === "number" ? null : new TypeCheckError(path, "number", value)),
  () => "number"
) as any) as IdentityType<number>

/**
 * A type that represents a string value.
 */
export const typesString = (new TypeChecker(
  (value, path) => (typeof value === "string" ? null : new TypeCheckError(path, "string", value)),
  () => "string"
) as any) as IdentityType<string>
