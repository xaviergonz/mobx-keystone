import { MaybeOptionalModelProp, OnlyPrimitives, OptionalModelProp, prop } from "../model/prop"
import type { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { isArray, isMap } from "../utils"
import { asMap, mapToArray } from "../wrappers/asMap"
import { PropTransform, transformedProp } from "./propTransform"

const arrayAsMapInnerTransform: PropTransform<
  [string, any][] | unknown,
  Map<string, any> | unknown
> = {
  propToData(arr) {
    return isArray(arr) ? asMap(arr) : arr
  },
  dataToProp(newMap) {
    if (!isMap(newMap)) {
      return newMap
    }

    return mapToArray(newMap)
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
