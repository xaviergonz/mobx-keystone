import { MaybeOptionalModelProp, OnlyPrimitives, OptionalModelProp, prop } from "../model/prop"
import type { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { isArray, isSet } from "../utils"
import { asSet, setToArray } from "../wrappers/asSet"
import { PropTransform, transformedProp } from "./propTransform"

const arrayAsSetInnerTransform: PropTransform<any[] | unknown, Set<any> | unknown> = {
  propToData(arr) {
    return isArray(arr) ? asSet(arr) : arr
  },
  dataToProp(newSet) {
    return isSet(newSet) ? setToArray(newSet) : newSet
  },
}

/**
 * Transforms sets into arrays.
 */
export type TransformSetToArray<T> =
  | (T extends Set<infer I> ? Array<I> : never)
  | Exclude<T, Set<any>>

/**
 * Transforms arrays into sets.
 */
export type TransformArrayToSet<T> =
  | (T extends Array<infer I> ? Set<I> : never)
  | Exclude<T, Array<any>>

export function prop_setArray<TValue>(): MaybeOptionalModelProp<TransformSetToArray<TValue>, TValue>

export function prop_setArray<TValue>(
  defaultFn: () => TValue
): OptionalModelProp<TransformSetToArray<TValue>, TValue>

export function prop_setArray<TValue>(
  defaultValue: OnlyPrimitives<TValue>
): OptionalModelProp<TransformSetToArray<TValue>, TValue>

export function prop_setArray(def?: any) {
  return transformedProp(prop(def), arrayAsSetInnerTransform, true)
}

export function tProp_setArray<TType extends AnyType>(
  type: TType
): MaybeOptionalModelProp<TypeToData<TType>, TransformArrayToSet<TypeToData<TType>>>

export function tProp_setArray<TType extends AnyType>(
  type: TType,
  defaultFn: () => TransformArrayToSet<TypeToData<TType>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToSet<TypeToData<TType>>>

export function tProp_setArray<TType extends AnyType>(
  type: TType,
  defaultValue: OnlyPrimitives<TransformArrayToSet<TypeToData<TType>>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToSet<TypeToData<TType>>>

export function tProp_setArray(typeOrDefaultValue: any, def?: any) {
  return transformedProp(tProp(typeOrDefaultValue, def), arrayAsSetInnerTransform, true)
}
