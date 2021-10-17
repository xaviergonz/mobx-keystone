import type { O } from "ts-toolbelt"
import type { IsNeverType, IsOptionalValue } from "../utils/types"
import type { TypeMeta } from "./typeMeta"

// type schemas

// infer is there just to cache type generation

export interface Type<Name, Data> {
  /** @ignore */
  $$type: Name

  /** @ignore */
  $$data: Data
}
export interface SnapshotProcessorType<TType, SnapshotInOverride, SnapshotOutOverride>
  extends Type<
    "snapshotProcessor",
    TypeToData<TType> &
      IsNeverType<
        SnapshotInOverride,
        unknown,
        TypeMeta<{ snapshotInOverride: SnapshotInOverride }>
      > &
      IsNeverType<
        SnapshotOutOverride,
        unknown,
        TypeMeta<{ snapshotOutOverride: SnapshotOutOverride }>
      >
  > {}

export interface IdentityType<Data> extends Type<"identity", Data> {}

export interface ModelType<Model> extends Type<"model", Model> {}

export interface ArrayType<S> // e.g. S = someType[] or [someType, someType]
  extends Type<
    "array",
    {
      [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never
    }
  > {}

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

export interface ObjectType<S>
  extends Type<
    "object",
    O.Optional<
      { [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never },
      UndefinablePropsNames<{ [k in keyof S]: TypeToDataOpt<S[k]> extends infer R ? R : never }>
    >
  > {}

export interface ObjectTypeFunction {
  (): ObjectOfTypes
}

export interface RecordType<S>
  extends Type<
    "record",
    {
      [k: string]: TypeToData<S> extends infer R ? R : never
    }
  > {}

export type AnyStandardType =
  | IdentityType<any>
  | ModelType<any>
  | ArrayType<any>
  | ObjectType<any>
  | RecordType<any>
  | SnapshotProcessorType<any, any, any>
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
export type TypeToDataOpt<S> = S extends { $$data: infer D } ? D & undefined : never
