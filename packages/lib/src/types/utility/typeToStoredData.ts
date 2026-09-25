import type { SimplifyObject } from "../../utils/types"
import type {
  ArrayType,
  ObjectOptionalKeys,
  ObjectType,
  ObjectTypeFunction,
  RecordType,
  TypeToData,
} from "../schemas"

type ArrayStoredData<S extends readonly unknown[]> = number extends S["length"]
  ? Array<TypeToStoredData<S[number]>>
  : {
      [k in keyof S]: TypeToStoredData<S[k]>
    }

type ObjectStoredData<S, OK = ObjectOptionalKeys<S>> = SimplifyObject<
  { [k in keyof S as k extends OK ? never : k]: TypeToStoredData<S[k]> } & {
    [k in keyof S as k extends OK ? k : never]?: TypeToStoredData<S[k]>
  }
>

// standard types are dispatched through their `$$type` discriminant (see TypeToSnapshotIn)
export type TypeToStoredData<S> = S extends ObjectTypeFunction
  ? ObjectStoredData<ReturnType<S>>
  : S extends { $$type: infer K }
    ? K extends "codec"
      ? S["$$storedData" & keyof S]
      : S extends ArrayType<infer A>
        ? ArrayStoredData<A>
        : S extends ObjectType<infer O>
          ? ObjectStoredData<O>
          : S extends RecordType<infer R>
            ? {
                [k: string]: TypeToStoredData<R>
              }
            : TypeToData<S>
    : TypeToData<S>
