import type { O } from "ts-toolbelt"
import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "../modelShared/BaseModelShared"
import type { SnapshotInOf, SnapshotOutOf } from "../snapshot/SnapshotOf"
import type { IsOptionalValue } from "../utils/types"

// type schemas

// infer is there just to cache type generation

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
  ? Array<TypeToData<S[number]> extends infer R ? R : never>
  : {
      [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never
    }

type ArraySnapshotInData<S extends readonly unknown[]> = number extends S["length"]
  ? Array<TypeToSnapshotIn<S[number]> extends infer R ? R : never>
  : {
      [k in keyof S]: TypeToSnapshotIn<S[k]> extends infer R ? R : never
    }

type ArraySnapshotOutData<S extends readonly unknown[]> = number extends S["length"]
  ? Array<TypeToSnapshotOut<S[number]> extends infer R ? R : never>
  : {
      [k in keyof S]: TypeToSnapshotOut<S[k]> extends infer R ? R : never
    }

export interface ArrayType<S extends readonly unknown[]> extends Type<"array", ArrayData<S>> {}

export interface ObjectOfTypes {
  /** @ignore */
  [k: string]: AnyType
}

/**
 * Name of the properties of an object that can be set to undefined, any or unknown.
 * @internal
 */
export type UndefinablePropsNames<T> = {
  [K in keyof T]: IsOptionalValue<T[K], K, never>
}[keyof T]

/**
 * Computes the optional keys for an object type schema.
 * @internal
 */
export type ObjectOptionalKeys<S> = UndefinablePropsNames<{
  [k in keyof S]: TypeToDataOpt<S[k]> extends infer R ? R : never
}>

type ObjectData<S> = O.Optional<
  { [k in keyof S]: TypeToData<S[k]> extends infer R ? R : never },
  ObjectOptionalKeys<S>
>

type ObjectSnapshotInData<S> = O.Optional<
  { [k in keyof S]: TypeToSnapshotIn<S[k]> extends infer R ? R : never },
  ObjectOptionalKeys<S>
>

type ObjectSnapshotOutData<S> = O.Optional<
  { [k in keyof S]: TypeToSnapshotOut<S[k]> extends infer R ? R : never },
  ObjectOptionalKeys<S>
>

type RecordData<S> = {
  [k: string]: TypeToData<S> extends infer R ? R : never
}

type RecordSnapshotInData<S> = {
  [k: string]: TypeToSnapshotIn<S> extends infer D ? D : never
}

type RecordSnapshotOutData<S> = {
  [k: string]: TypeToSnapshotOut<S> extends infer D ? D : never
}

export interface ObjectType<S> extends Type<"object", ObjectData<S>> {}

export interface ObjectTypeFunction {
  // biome-ignore lint/style/useShorthandFunctionType: make the type recursive
  (): ObjectOfTypes
}

export interface RecordType<S> extends Type<"record", RecordData<S>> {}

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
    : S extends { $$data: infer D }
      ? D
      : ConstructorToSnapshotData<S>

export type TypeToData<S> = S extends ObjectTypeFunction
  ? ObjectType<ReturnType<S>>["$$data"] extends infer R
    ? R
    : never
  : TypeToDataLeaf<S>

export type TypeToSnapshotIn<S> = S extends ObjectTypeFunction
  ? ObjectSnapshotInData<ReturnType<S>> extends infer R
    ? R
    : never
  : S extends CodecType<any, infer D, any>
    ? D
    : S extends ArrayType<infer A>
      ? ArraySnapshotInData<A>
      : S extends ObjectType<infer O>
        ? ObjectSnapshotInData<O>
        : S extends RecordType<infer R>
          ? RecordSnapshotInData<R>
          : S extends ModelType<infer M>
            ? SnapshotInOf<M>
            : TypeToSnapshotLeaf<S, "in">

export type TypeToSnapshotOut<S> = S extends ObjectTypeFunction
  ? ObjectSnapshotOutData<ReturnType<S>> extends infer R
    ? R
    : never
  : S extends CodecType<any, any, infer D>
    ? D
    : S extends ArrayType<infer A>
      ? ArraySnapshotOutData<A>
      : S extends ObjectType<infer O>
        ? ObjectSnapshotOutData<O>
        : S extends RecordType<infer R>
          ? RecordSnapshotOutData<R>
          : S extends ModelType<infer M>
            ? SnapshotOutOf<M>
            : TypeToSnapshotLeaf<S, "out">

/** @ignore */
export type TypeToDataOpt<S> = S extends { $$data: infer D } ? D & undefined : never
