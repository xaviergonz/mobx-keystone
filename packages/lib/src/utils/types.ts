/**
 * @ignore
 *
 * A primitive value.
 */
export type PrimitiveValue = undefined | null | boolean | number | string | bigint

/**
 * @ignore
 *
 * Checks if a value is optional (undefined, any or unknown).
 *
 * Examples:
 * - string = false
 * - undefined = true
 * - string | undefined = true
 * - string & undefined = false, but we don't care
 * - any = true
 * - unknown = true
 * - null = false
 * - string | null = false
 * - string & null = false
 */
export type IsOptionalValue<C, TV, FV> = undefined extends C ? TV : FV

// type _A = IsOptionalValue<string, true, false> // false
// type _B = IsOptionalValue<undefined, true, false> // true
// type _C = IsOptionalValue<string | undefined, true, false> // true
// type _D = IsOptionalValue<string & undefined, true, false> // false, but we don't care
// type _E = IsOptionalValue<any, true, false> // true
// type _F = IsOptionalValue<unknown, true, false> // true

/**
 * @ignore
 *
 * An array that must have at least one element.
 */
export interface NonEmptyArray<T> extends Array<T> {
  0: T
}

/**
 * @ignore
 *
 * A read-only array that must have at least one element.
 */
export interface ReadonlyNonEmptyArray<T> extends ReadonlyArray<T> {
  readonly 0: T
}
