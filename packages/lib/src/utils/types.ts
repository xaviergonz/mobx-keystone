/**
 * @ignore
 *
 * A primitive value.
 */
export type PrimitiveValue = undefined | null | boolean | number | string | bigint

/**
 * @ignore
 *
 * A JSON-compatible primitive value.
 */
export type JSONPrimitiveValue = null | boolean | number | string

/**
 * @ignore
 *
 * Checks if a value is optional (undefined or any).
 *
 * Examples:
 * - string = false
 * - undefined = true
 * - string | undefined = true
 * - string & undefined = false, but we don't care
 * - any = true
 * - unknown = false, but we don't care
 * - null = false
 * - string | null = false
 * - string & null = false
 */
export type IsOptionalValue<C, TV, FV> = IsNeverType<Extract<C, undefined>, FV, TV>

// type _A = IsOptionalValue<string, true, false> // false
// type _B = IsOptionalValue<undefined, true, false> // true
// type _C = IsOptionalValue<string | undefined, true, false> // true
// type _D = IsOptionalValue<string & undefined, true, false> // false, but we don't care
// type _E = IsOptionalValue<any, true, false> // true
// type _F = IsOptionalValue<unknown, true, false> // false, but we don't care

/**
 * @ignore
 */
export type IsNeverType<T, IfNever, IfNotNever> = [T] extends [never] ? IfNever : IfNotNever

/**
 * @ignore
 */
export type Flatten<T> = T extends Record<any, any> ? { [P in keyof T]: T[P] } : T
