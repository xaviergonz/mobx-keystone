import { MaybeOptionalModelProp, OnlyPrimitives, OptionalModelProp, prop } from "../model/prop"
import type { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { immutableDate } from "./ImmutableDate"
import { propTransform, transformedProp } from "./propTransform"

/**
 * Property transform for ISO date strings to Date objects and vice-versa.
 * If a model property, consider using `prop_dateString` or `tProp_dateString` instead.
 */
export const stringAsDate = propTransform<string | null | undefined, Date | null | undefined>({
  propToData(prop) {
    if (typeof prop !== "string") {
      return prop
    }
    return immutableDate(prop) as Date
  },
  dataToProp(date) {
    return date instanceof Date ? date.toJSON() : date
  },
})

/**
 * Transforms dates into strings.
 */
export type TransformDateToString<T> = (T extends Date ? string : never) | Exclude<T, Date>

/**
 * Transforms strings into dates.
 */
export type TransformStringToDate<T> = (T extends string ? Date : never) | Exclude<T, string>

export function prop_dateString<TValue>(): MaybeOptionalModelProp<
  TransformDateToString<TValue>,
  TValue
>

export function prop_dateString<TValue>(
  defaultFn: () => TValue
): OptionalModelProp<TransformDateToString<TValue>, TValue>

export function prop_dateString<TValue>(
  defaultValue: OnlyPrimitives<TValue>
): OptionalModelProp<TransformDateToString<TValue>, TValue>

export function prop_dateString(def?: any) {
  return transformedProp(prop(def), stringAsDate, true)
}

export function tProp_dateString<TType extends AnyType>(
  type: TType
): MaybeOptionalModelProp<TypeToData<TType>, TransformStringToDate<TypeToData<TType>>>

export function tProp_dateString<TType extends AnyType>(
  type: TType,
  defaultFn: () => TransformStringToDate<TypeToData<TType>>
): OptionalModelProp<TypeToData<TType>, TransformStringToDate<TypeToData<TType>>>

export function tProp_dateString<TType extends AnyType>(
  type: TType,
  defaultValue: OnlyPrimitives<TransformStringToDate<TypeToData<TType>>>
): OptionalModelProp<TypeToData<TType>, TransformStringToDate<TypeToData<TType>>>

export function tProp_dateString(typeOrDefaultValue: any, def?: any) {
  return transformedProp(tProp(typeOrDefaultValue, def), stringAsDate, true)
}
