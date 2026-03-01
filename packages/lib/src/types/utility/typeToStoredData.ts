import type { O } from "ts-toolbelt"
import type {
  ArrayType,
  CodecType,
  ObjectOptionalKeys,
  ObjectType,
  ObjectTypeFunction,
  RecordType,
  TypeToData,
} from "../schemas"

type ArrayStoredData<S extends readonly unknown[]> = number extends S["length"]
  ? Array<TypeToStoredData<S[number]> extends infer R ? R : never>
  : {
      [k in keyof S]: TypeToStoredData<S[k]> extends infer R ? R : never
    }

type ObjectStoredData<S> = O.Optional<
  { [k in keyof S]: TypeToStoredData<S[k]> extends infer R ? R : never },
  ObjectOptionalKeys<S>
>

/**
 * @internal
 */
export type TypeToStoredData<S> = S extends ObjectTypeFunction
  ? ObjectStoredData<ReturnType<S>> extends infer R
    ? R
    : never
  : S extends CodecType<any, any, any, infer D>
    ? D
    : S extends ArrayType<infer A>
      ? ArrayStoredData<A>
      : S extends ObjectType<infer O>
        ? ObjectStoredData<O>
        : S extends RecordType<infer R>
          ? {
              [k: string]: TypeToStoredData<R> extends infer D ? D : never
            }
          : TypeToData<S>
