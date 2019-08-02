import { O } from "ts-toolbelt"

// type schemas

// infer is there just to cache type generation

export interface IdentityType<T> {
  $$identityType: T
}

export interface ArrayType<S extends AnyType> {
  $$arrayType: TypeToData<S>[] extends infer R ? R : never
}

export interface ObjectOfTypes {
  [k: string]: AnyType
}

/**
 * Checks if a value is optional (undefined, any or unknown).
 * @hidden
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
type IsOptionalValue<C, TV, FV> = undefined extends C ? TV : FV

// type _A = IsOptionalValue<string, true, false> // false
// type _B = IsOptionalValue<undefined, true, false> // true
// type _C = IsOptionalValue<string | undefined, true, false> // true
// type _D = IsOptionalValue<string & undefined, true, false> // false, but we don't care
// type _E = IsOptionalValue<any, true, false> // true
// type _F = IsOptionalValue<unknown, true, false> // true

/**
 * Name of the properties of an object that can be set to undefined, any or unknown
 * @hidden
 */
type UndefinablePropsNames<T> = { [K in keyof T]: IsOptionalValue<T[K], K, never> }[keyof T]

export interface ObjectType<S extends ObjectOfTypes> {
  $$objectTypeData: { [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never }
  $$objectUndefinablePropNames: UndefinablePropsNames<this["$$objectTypeData"]>
  $$objectType: O.Optional<this["$$objectTypeData"], this["$$objectUndefinablePropNames"]>
}

export interface ObjectTypeFunction<S extends ObjectOfTypes> {
  (): S
}

export interface ObjectMapType<S extends AnyType> {
  $$objectMapType: {
    [k: string]: TypeToData<S> extends infer R ? R : never
  }
}

export interface OrType<S extends AnyType[]> {
  $$orType: TypeToData<S[number]> extends infer R ? R : never
}

export type AnyType =
  | IdentityType<any>
  | ArrayType<any>
  | OrType<any>
  | ObjectType<any>
  | ObjectMapType<any>
  | ObjectTypeFunction<any>

// type schemas to actual types

export type TypeToData<S extends AnyType> = S extends ObjectTypeFunction<infer S2>
  ? ObjectType<S2>["$$objectType"] extends infer R
    ? R
    : never
  : S extends ObjectType<any>
  ? S["$$objectType"] extends infer R
    ? R
    : never
  : S extends ObjectMapType<any>
  ? S["$$objectMapType"] extends infer R
    ? R
    : never
  : S extends ArrayType<any>
  ? S["$$arrayType"] extends infer R
    ? R
    : never
  : S extends OrType<any>
  ? S["$$orType"] extends infer R
    ? R
    : never
  : S extends IdentityType<any>
  ? S["$$identityType"] extends infer R
    ? R
    : never
  : never
