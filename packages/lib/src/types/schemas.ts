import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "../modelShared/BaseModelShared"
import type { SnapshotInOf, SnapshotOutOf } from "../snapshot/SnapshotOf"
import type { IsOptionalValue, SimplifyObject } from "../utils/types"

// type schemas

export interface Type<Name, Data> {
  /** @ignore */
  $$type: Name

  /** @ignore */
  $$data: Data
}

export interface IdentityType<Data> extends Type<"identity", Data> {}

export interface ModelType<Model> extends Type<"model", Model> {}

export interface CodecType<
  Runtime,
  SnapshotIn = Runtime,
  SnapshotOut = SnapshotIn,
  StoredData = Runtime,
> extends Type<"codec", Runtime> {
  /** @ignore */
  $$snapshotIn: SnapshotIn

  /** @ignore */
  $$snapshotOut: SnapshotOut

  /** @ignore */
  $$storedData: StoredData
}

type ArrayData<S extends readonly unknown[]> = number extends S["length"]
  ? Array<TypeToData<S[number]>>
  : {
      [k in keyof S]: TypeToData<S[k]>
    }

type ArraySnapshotInData<S extends readonly unknown[]> = number extends S["length"]
  ? Array<TypeToSnapshotIn<S[number]>>
  : {
      [k in keyof S]: TypeToSnapshotIn<S[k]>
    }

type ArraySnapshotOutData<S extends readonly unknown[]> = number extends S["length"]
  ? Array<TypeToSnapshotOut<S[number]>>
  : {
      [k in keyof S]: TypeToSnapshotOut<S[k]>
    }

export interface ArrayType<S extends readonly unknown[]> extends Type<"array", ArrayData<S>> {}

export interface ObjectOfTypes {
  /** @ignore */
  [k: string]: AnyType
}

/**
 * Name of the properties of an object that can be set to undefined, any or unknown.
 * @ignore
 */
export type UndefinablePropsNames<T> = {
  [K in keyof T]: IsOptionalValue<T[K], K, never>
}[keyof T]

/**
 * Computes the optional keys for an object type schema.
 * @ignore
 */
export type ObjectOptionalKeys<S> = {
  [K in keyof S]: IsOptionalValue<TypeToDataOpt<S[K]>, K, never>
}[keyof S]

type ObjectData<S, OK = ObjectOptionalKeys<S>> = SimplifyObject<
  { [k in keyof S as k extends OK ? never : k]: TypeToData<S[k]> } & {
    [k in keyof S as k extends OK ? k : never]?: TypeToData<S[k]>
  }
>

type ObjectSnapshotInData<S, OK = ObjectOptionalKeys<S>> = SimplifyObject<
  { [k in keyof S as k extends OK ? never : k]: TypeToSnapshotIn<S[k]> } & {
    [k in keyof S as k extends OK ? k : never]?: TypeToSnapshotIn<S[k]>
  }
>

type ObjectSnapshotOutData<S, OK = ObjectOptionalKeys<S>> = SimplifyObject<
  { [k in keyof S as k extends OK ? never : k]: TypeToSnapshotOut<S[k]> } & {
    [k in keyof S as k extends OK ? k : never]?: TypeToSnapshotOut<S[k]>
  }
>

export interface ObjectType<S> extends Type<"object", ObjectData<S>> {}

export interface ObjectTypeFunction {
  // biome-ignore lint/style/useShorthandFunctionType: make the type recursive
  (): ObjectOfTypes
}

// the record data types are written inline (instead of through an alias) so they are displayed as
// plain index signatures (e.g. `{ [k: string]: number }`)
export interface RecordType<S> extends Type<"record", { [k: string]: TypeToData<S> }> {}

export type AnyStandardType =
  | IdentityType<any>
  | ModelType<any>
  | CodecType<any, any>
  | ArrayType<any>
  | ObjectType<any>
  | RecordType<any>
  | ObjectTypeFunction

export type AnyType = null | undefined | AnyNonValueType

export type AnyNonValueType =
  | ModelClass<AnyModel>
  | ModelClass<AnyDataModel>
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | BigIntConstructor
  | AnyStandardType

// type schemas to actual types

type ConstructorToType<S, BigIntMapping> = S extends StringConstructor
  ? string
  : S extends NumberConstructor
    ? number
    : S extends BooleanConstructor
      ? boolean
      : S extends BigIntConstructor
        ? BigIntMapping
        : S extends null
          ? null
          : S extends undefined
            ? undefined
            : never

type ConstructorToData<S> = ConstructorToType<S, bigint>

type ConstructorToSnapshotData<S> = ConstructorToType<S, string>

type TypeToDataLeaf<S> =
  S extends ModelClass<infer M> ? M : S extends { $$data: infer D } ? D : ConstructorToData<S>

type TypeToSnapshotLeaf<S, Dir extends "in" | "out"> =
  S extends ModelClass<infer M>
    ? Dir extends "in"
      ? SnapshotInOf<M>
      : SnapshotOutOf<M>
    : ConstructorToSnapshotData<S>

export type TypeToData<S> = S extends ObjectTypeFunction
  ? ObjectType<ReturnType<S>>["$$data"]
  : TypeToDataLeaf<S>

// standard types are dispatched through their `$$type` discriminant (and codec / identity types
// through indexed accesses), which is cheaper than checking them against each type interface
export type TypeToSnapshotIn<S> = S extends ObjectTypeFunction
  ? ObjectSnapshotInData<ReturnType<S>>
  : S extends { $$type: infer K }
    ? K extends "codec"
      ? S["$$snapshotIn" & keyof S]
      : S extends ArrayType<infer A>
        ? ArraySnapshotInData<A>
        : S extends ObjectType<infer O>
          ? ObjectSnapshotInData<O>
          : S extends RecordType<infer R>
            ? { [k: string]: TypeToSnapshotIn<R> }
            : S extends ModelType<infer M>
              ? SnapshotInOf<M>
              : S["$$data" & keyof S]
    : TypeToSnapshotLeaf<S, "in">

export type TypeToSnapshotOut<S> = S extends ObjectTypeFunction
  ? ObjectSnapshotOutData<ReturnType<S>>
  : S extends { $$type: infer K }
    ? K extends "codec"
      ? S["$$snapshotOut" & keyof S]
      : S extends ArrayType<infer A>
        ? ArraySnapshotOutData<A>
        : S extends ObjectType<infer O>
          ? ObjectSnapshotOutData<O>
          : S extends RecordType<infer R>
            ? { [k: string]: TypeToSnapshotOut<R> }
            : S extends ModelType<infer M>
              ? SnapshotOutOf<M>
              : S["$$data" & keyof S]
    : TypeToSnapshotLeaf<S, "out">

/** @ignore */
export type TypeToDataOpt<S> = S extends { $$data: unknown } ? S["$$data"] & undefined : never
