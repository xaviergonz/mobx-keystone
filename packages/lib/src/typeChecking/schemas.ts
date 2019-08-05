import { O } from "ts-toolbelt"
import { IsOptionalValue } from "../utils/types"

// type schemas

// infer is there just to cache type generation

export interface IdentityType<T> {
  $$identityType: T
  $$identityTypeOpt: T & undefined
}

export interface ArrayType<S extends AnyType> {
  $$arrayType: TypeToData<S>[] extends infer R ? R : never
}

export interface ObjectOfTypes {
  [k: string]: AnyType
}

/**
 * Name of the properties of an object that can be set to undefined, any or unknown
 */
type UndefinablePropsNames<T> = {
  [K in keyof T]: IsOptionalValue<T[K], K, never>
}[keyof T]

export interface ObjectType<S extends ObjectOfTypes> {
  $$objectTypeData: { [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never }

  $$objectTypeOpt: { [k in keyof S]: TypeToDataOpt<S[k]> extends infer R ? R : never }
  $$objectUndefinablePropNames: UndefinablePropsNames<this["$$objectTypeOpt"]>

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
  $$orTypeOpt: TypeToDataOpt<S[number]> extends infer R ? R : never
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

type TypeToDataOpt<S extends AnyType> = S extends OrType<any>
  ? S["$$orTypeOpt"] extends infer R
    ? R
    : never
  : S extends IdentityType<any>
  ? S["$$identityTypeOpt"] extends infer R
    ? R
    : never
  : never
