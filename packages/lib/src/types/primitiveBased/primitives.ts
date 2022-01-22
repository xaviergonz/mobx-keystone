import { assertIsPrimitive } from "../../utils"
import type { PrimitiveValue } from "../../utils/types"
import { registerStandardTypeResolver } from "../resolveTypeChecker"
import type { AnyStandardType, IdentityType } from "../schemas"
import { TypeChecker, TypeCheckerBaseType, TypeInfo, TypeInfoGen } from "../TypeChecker"
import { TypeCheckError } from "../TypeCheckError"

const identityFn = <T>(x: T): T => x

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

  const thisTc: TypeChecker = new TypeChecker(
    TypeCheckerBaseType.Primitive,

    (value, path) => (value === literal ? null : new TypeCheckError(path, typeName, value)),

    () => typeName,
    typeInfoGen,

    (value) => (value === literal ? thisTc : null),
    identityFn,
    identityFn
  )

  return thisTc as any
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

registerStandardTypeResolver((v) => (v === undefined ? typesUndefined : undefined))

/**
 * A type that represents the value null.
 * Syntactic sugar for `types.literal(null)`.
 *
 * ```ts
 * types.null
 * ```
 */
export const typesNull = typesLiteral(null)

registerStandardTypeResolver((v) => (v === null ? typesNull : undefined))

/**
 * A type that represents any boolean value.
 *
 * ```ts
 * types.boolean
 * ```
 */
export const typesBoolean: IdentityType<boolean> = new TypeChecker(
  TypeCheckerBaseType.Primitive,

  (value, path) => (typeof value === "boolean" ? null : new TypeCheckError(path, "boolean", value)),

  () => "boolean",
  (t) => new BooleanTypeInfo(t),

  (value) => (typeof value === "boolean" ? (typesBoolean as any) : null),
  identityFn,
  identityFn
) as any

registerStandardTypeResolver((v) => (v === Boolean ? typesBoolean : undefined))

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
  TypeCheckerBaseType.Primitive,

  (value, path) => (typeof value === "number" ? null : new TypeCheckError(path, "number", value)),

  () => "number",
  (t) => new NumberTypeInfo(t),

  (value) => (typeof value === "number" ? (typesNumber as any) : null),
  identityFn,
  identityFn
) as any

registerStandardTypeResolver((v) => (v === Number ? typesNumber : undefined))

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
  TypeCheckerBaseType.Primitive,

  (value, path) => (typeof value === "string" ? null : new TypeCheckError(path, "string", value)),

  () => "string",
  (t) => new StringTypeInfo(t),

  (value) => (typeof value === "string" ? (typesString as any) : null),
  identityFn,
  identityFn
) as any

registerStandardTypeResolver((v) => (v === String ? typesString : undefined))

/**
 * `types.string` type info.
 */
export class StringTypeInfo extends TypeInfo {}
