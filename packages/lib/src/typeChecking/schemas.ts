import { O } from "ts-toolbelt"
import { IsOptionalValue } from "../utils/types"

// type schemas

// infer is there just to cache type generation

export interface IdentityType<T> {
  /** @ignore */
  $$identityType: T
}

export interface ArrayType<S> {
  /** @ignore */
  $$arrayType: Array<TypeToData<S>> extends infer R ? R : never
}

export interface ObjectOfTypes {
  /** @ignore */
  [k: string]: AnyType
}

/**
 * Name of the properties of an object that can be set to undefined, any or unknown
 */
type UndefinablePropsNames<T> = {
  [K in keyof T]: IsOptionalValue<T[K], K, never>
}[keyof T]

export interface ObjectType<S> {
  /** @ignore */
  $$objectTypeData: { [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never }

  /** @ignore */
  $$objectTypeOpt: { [k in keyof S]: TypeToDataOpt<S[k]> extends infer R ? R : never }

  /** @ignore */
  $$objectUndefinablePropNames: UndefinablePropsNames<this["$$objectTypeOpt"]>

  /** @ignore */
  $$objectType: O.Optional<this["$$objectTypeData"], this["$$objectUndefinablePropNames"]>
}

export interface ObjectTypeFunction {
  (): ObjectOfTypes
}

export interface RecordType<S> {
  /** @ignore */
  $$recordType: {
    [k: string]: TypeToData<S> extends infer R ? R : never
  }
}

export type AnyStandardType =
  | IdentityType<any>
  | ArrayType<any>
  | ObjectType<any>
  | RecordType<any>
  | ObjectTypeFunction

export type AnyType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | null
  | undefined
  | AnyStandardType

// type schemas to actual types

export type TypeToData<S> = S extends ObjectTypeFunction
  ? ObjectType<ReturnType<S>>["$$objectType"] extends infer R
    ? R
    : never
  : S extends ObjectType<any>
  ? S["$$objectType"] extends infer R
    ? R
    : never
  : S extends RecordType<any>
  ? S["$$recordType"] extends infer R
    ? R
    : never
  : S extends ArrayType<any>
  ? S["$$arrayType"] extends infer R
    ? R
    : never
  : S extends IdentityType<any>
  ? S["$$identityType"] extends infer R
    ? R
    : never
  : S extends StringConstructor // String
  ? string
  : S extends NumberConstructor // Number
  ? number
  : S extends BooleanConstructor // Boolean
  ? boolean
  : S extends null // null
  ? null
  : S extends undefined // undefined
  ? undefined
  : never // anything else

/** @ignore */
export type TypeToDataOpt<S> = S extends IdentityType<any> ? S["$$identityType"] & undefined : never
