import {
  MaybeOptionalModelProp,
  OnlyPrimitives,
  OptionalModelProp,
  prop,
} from "../modelShared/prop"
import type { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { isArray, isSet } from "../utils"
import { asSet, setToArray } from "../wrappers/asSet"
import { PropTransform, transformedProp } from "./propTransform"

const arrayAsSetInnerTransform: PropTransform<any[] | unknown, Set<any> | unknown> = {
  propToData(arrayOrSet) {
    return isArray(arrayOrSet) ? asSet(arrayOrSet) : arrayOrSet
  },
  dataToProp(setOrArray) {
    return isSet(setOrArray) ? setToArray(setOrArray) : setOrArray
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
  return transformedProp(arguments.length >= 1 ? prop(def) : prop(), arrayAsSetInnerTransform, true)
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
  return transformedProp(
    arguments.length >= 2 ? tProp(typeOrDefaultValue, def) : tProp(typeOrDefaultValue),
    arrayAsSetInnerTransform,
    true
  )
}
