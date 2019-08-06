import { O } from "ts-toolbelt"
import { IsOptionalValue } from "../utils/types"

// type schemas

// infer is there just to cache type generation

export interface IdentityType<T> {
  /** @hidden */
  $$identityType: T
  /** @hidden */
  $$identityTypeOpt: T & undefined
}

export interface ArrayType<S extends AnyType> {
  /** @hidden */
  $$arrayType: TypeToData<S>[] extends infer R ? R : never
}

export interface ObjectOfTypes {
  /** @hidden */
  [k: string]: AnyType
}

/**
 * Name of the properties of an object that can be set to undefined, any or unknown
 */
type UndefinablePropsNames<T> = {
  [K in keyof T]: IsOptionalValue<T[K], K, never>
}[keyof T]

export interface ObjectType<S extends ObjectOfTypes> {
  /** @hidden */
  $$objectTypeData: { [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never }

  /** @hidden */
  $$objectTypeOpt: { [k in keyof S]: TypeToDataOpt<S[k]> extends infer R ? R : never }

  /** @hidden */
  $$objectUndefinablePropNames: UndefinablePropsNames<this["$$objectTypeOpt"]>

  /** @hidden */
  $$objectType: O.Optional<this["$$objectTypeData"], this["$$objectUndefinablePropNames"]>
}

export interface ObjectTypeFunction<S extends ObjectOfTypes> {
  (): S
}

export interface ObjectMapType<S extends AnyType> {
  /** @hidden */
  $$objectMapType: {
    [k: string]: TypeToData<S> extends infer R ? R : never
  }
}

export interface OrType<S extends AnyType[]> {
  /** @hidden */
  $$orType: TypeToData<S[number]> extends infer R ? R : never
  /** @hidden */
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

/** @hidden */
export type TypeToDataOpt<S extends AnyType> = S extends OrType<any>
  ? S["$$orTypeOpt"] extends infer R
    ? R
    : never
  : S extends IdentityType<any>
  ? S["$$identityTypeOpt"] extends infer R
    ? R
    : never
  : never
