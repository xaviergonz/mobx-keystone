import { assertIsPrimitive } from "../utils"
import { PrimitiveValue } from "../utils/types"
import { typesRefinement } from "./refinement"
import { IdentityType } from "./schemas"
import { TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents a certain value of a primitive (for example an *exact* number or string).
 *
 * Example
 * ```ts
 * const hiType = types.literal("hi") // the string with value "hi"
 * const number5Type = types.literal(5) // the number with value 5
 * ```
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
 *
 * ```ts
 * types.undefined
 * ```
 */
export const typesUndefined = typesLiteral(undefined)

/**
 * A type that represents the value null.
 *
 * ```ts
 * types.null
 * ```
 */
export const typesNull = typesLiteral(null)

/**
 * A type that represents any boolean value.
 *
 * ```ts
 * types.boolean
 * ```
 */
export const typesBoolean = (new TypeChecker(
  (value, path) => (typeof value === "boolean" ? null : new TypeCheckError(path, "boolean", value)),
  () => "boolean"
) as any) as IdentityType<boolean>

/**
 * A type that represents any number value.
 *
 * ```ts
 * types.number
 * ```
 */
export const typesNumber = (new TypeChecker(
  (value, path) => (typeof value === "number" ? null : new TypeCheckError(path, "number", value)),
  () => "number"
) as any) as IdentityType<number>

/**
 * A type that represents any string value.
 *
 * ```ts
 * types.string
 * ```
 */
export const typesString = (new TypeChecker(
  (value, path) => (typeof value === "string" ? null : new TypeCheckError(path, "string", value)),
  () => "string"
) as any) as IdentityType<string>

/**
 * A type that represents any integer number value.
 *
 * ```ts
 * types.integer
 * ```
 */
export const typesInteger = typesRefinement(typesNumber, n => Number.isInteger(n), "integer")

/**
 * A type that represents any string value other than "".
 *
 * ```ts
 * types.nonEmptyString
 * ```
 */
export const typesNonEmptyString = typesRefinement(typesString, s => s !== "", "nonEmpty")
