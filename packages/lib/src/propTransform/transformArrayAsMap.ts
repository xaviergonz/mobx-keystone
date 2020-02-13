import { MaybeOptionalModelProp, OnlyPrimitives, OptionalModelProp, prop } from "../model/prop"
import { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { isArray, isMap } from "../utils"
import { arrayAsMap } from "../wrappers"
import { PropTransform, transformedProp } from "./propTransform"

/**
 * A map expressed as an array.
 */
export type TransformArrayAsMap<V> = [string, V][]

const arrayAsMapInnerTransform: PropTransform<
  [string, any][] | unknown,
  Map<string, any> | unknown
> = {
  propToData(arr) {
    return isArray(arr) ? arrayAsMap(() => arr) : arr
  },
  dataToProp(newMap) {
    if (!isMap(newMap)) {
      return newMap
    }

    const arr: TransformArrayAsMap<any> = []
    for (const k of newMap.keys()) {
      arr.push([k, newMap.get(k)])
    }

    return arr
  },
}

/**
 * Transforms maps into arrays.
 */
export type TransformMapToArray<T> =
  | (T extends Map<string, infer I> ? [string, I][] : never)
  | Exclude<T, Map<string, any>>

/**
 * Transforms arrays into maps.
 */
export type TransformArrayToMap<T> =
  | (T extends [string, infer I][] ? Map<string, I> : never)
  | Exclude<T, [string, any][]>

export function prop_mapArray<TValue>(): MaybeOptionalModelProp<TransformMapToArray<TValue>, TValue>

export function prop_mapArray<TValue>(
  defaultFn: () => TValue
): OptionalModelProp<TransformMapToArray<TValue>, TValue>

export function prop_mapArray<TValue>(
  defaultValue: OnlyPrimitives<TValue>
): OptionalModelProp<TransformMapToArray<TValue>, TValue>

export function prop_mapArray(def?: any) {
  return transformedProp(prop(def), arrayAsMapInnerTransform, true)
}

export function tProp_mapArray<TType extends AnyType>(
  type: TType
): MaybeOptionalModelProp<TypeToData<TType>, TransformArrayToMap<TypeToData<TType>>>

export function tProp_mapArray<TType extends AnyType>(
  type: TType,
  defaultFn: () => TransformArrayToMap<TypeToData<TType>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToMap<TypeToData<TType>>>

export function tProp_mapArray<TType extends AnyType>(
  type: TType,
  defaultValue: OnlyPrimitives<TransformArrayToMap<TypeToData<TType>>>
): OptionalModelProp<TypeToData<TType>, TransformArrayToMap<TypeToData<TType>>>

export function tProp_mapArray(typeOrDefaultValue: any, def?: any) {
  return transformedProp(tProp(typeOrDefaultValue, def), arrayAsMapInnerTransform, true)
}
