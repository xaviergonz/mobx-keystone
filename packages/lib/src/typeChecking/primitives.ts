import { assertIsPrimitive } from "../utils"
import type { PrimitiveValue } from "../utils/types"
import { registerStandardType } from "./resolveTypeChecker"
import type { AnyStandardType, IdentityType } from "./schemas"
import { TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
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

  const typeInfoGen: TypeInfoGen = (t) => new LiteralTypeInfo(t, literal)

  return new TypeChecker(
    (value, path) => (value === literal ? null : new TypeCheckError(path, typeName, value)),
    () => typeName,
    typeInfoGen
  ) as any
}

/**
 * `types.literal` type info.
 */
export class LiteralTypeInfo extends TypeInfo {
  constructor(thisType: AnyStandardType, readonly literal: PrimitiveValue) {
    super(thisType)
  }
}

/**
 * A type that represents the value undefined.
 * Syntactic sugar for `types.literal(undefined)`.
 *
 * ```ts
 * types.undefined
 * ```
 */
export const typesUndefined = typesLiteral(undefined)

registerStandardType(undefined, typesUndefined)

/**
 * A type that represents the value null.
 * Syntactic sugar for `types.literal(null)`.
 *
 * ```ts
 * types.null
 * ```
 */
export const typesNull = typesLiteral(null)

registerStandardType(null, typesNull)

/**
 * A type that represents any boolean value.
 *
 * ```ts
 * types.boolean
 * ```
 */
export const typesBoolean: IdentityType<boolean> = new TypeChecker(
  (value, path) => (typeof value === "boolean" ? null : new TypeCheckError(path, "boolean", value)),
  () => "boolean",
  (t) => new BooleanTypeInfo(t)
) as any

registerStandardType(Boolean, typesBoolean)

/**
 * `types.boolean` type info.
 */
export class BooleanTypeInfo extends TypeInfo {}

/**
 * A type that represents any number value.
 *
 * ```ts
 * types.number
 * ```
 */
export const typesNumber: IdentityType<number> = new TypeChecker(
  (value, path) => (typeof value === "number" ? null : new TypeCheckError(path, "number", value)),
  () => "number",
  (t) => new NumberTypeInfo(t)
) as any

registerStandardType(Number, typesNumber)

/**
 * `types.number` type info.
 */
export class NumberTypeInfo extends TypeInfo {}

/**
 * A type that represents any string value.
 *
 * ```ts
 * types.string
 * ```
 */
export const typesString: IdentityType<string> = new TypeChecker(
  (value, path) => (typeof value === "string" ? null : new TypeCheckError(path, "string", value)),
  () => "string",
  (t) => new StringTypeInfo(t)
) as any

registerStandardType(String, typesString)

/**
 * `types.string` type info.
 */
export class StringTypeInfo extends TypeInfo {}
