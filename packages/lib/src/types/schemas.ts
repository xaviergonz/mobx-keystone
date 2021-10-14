import type { O } from "ts-toolbelt"
import type { IsOptionalValue } from "../utils/types"

// type schemas

// infer is there just to cache type generation

export interface IdentityType<T> {
  /** @ignore */
  $$type: "identity"

  /** @ignore */
  $$data: T
}

export interface ArrayType<S> {
  /** @ignore */
  $$type: "array"

  /** @ignore */
  $$data: {
    [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never
  }
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
  $$type: "object"

  /** @ignore */
  $$dataFull: { [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never }

  /** @ignore */
  $$dataOpt: { [k in keyof S]: TypeToDataOpt<S[k]> extends infer R ? R : never }

  /** @ignore */
  $$dataUndefinablePropNames: UndefinablePropsNames<this["$$dataOpt"]>

  /** @ignore */
  $$data: O.Optional<this["$$dataFull"], this["$$dataUndefinablePropNames"]>
}

export interface ObjectTypeFunction {
  (): ObjectOfTypes
}

export interface RecordType<S> {
  /** @ignore */
  $$type: "record"

  /** @ignore */
  $$data: {
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
  ? ObjectType<ReturnType<S>>["$$data"] extends infer R
    ? R
    : never
  : S extends { $$data: any }
  ? S["$$data"] extends infer R
    ? R
    : never
  : // String
  S extends StringConstructor
  ? string
  : // Number
  S extends NumberConstructor
  ? number
  : // Boolean
  S extends BooleanConstructor
  ? boolean
  : // null
  S extends null
  ? null
  : // undefined
  S extends undefined
  ? undefined
  : // anything else
    never

/** @ignore */
export type TypeToDataOpt<S> = S extends IdentityType<any> ? S["$$data"] & undefined : never
