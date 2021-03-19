import {
  MaybeOptionalModelProp,
  OnlyPrimitives,
  OptionalModelProp,
  prop,
} from "../modelShared/prop"
import type { AnyType, TypeToData } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import { immutableDate } from "./ImmutableDate"
import { PropTransform, transformedProp } from "./propTransform"

/**
 * Property transform for ISO date strings to Date objects and vice-versa.
 * If a model property, consider using `prop_dateString` or `tProp_dateString` instead.
 */
export const stringAsDate: PropTransform<string | null | undefined, Date | null | undefined> = {
  propToData(stringOrDate) {
    if (typeof stringOrDate !== "string") {
      return stringOrDate
    }
    return immutableDate(stringOrDate) as Date
  },
  dataToProp(dateOrString) {
    return dateOrString instanceof Date ? dateOrString.toJSON() : dateOrString
  },
}

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
  return transformedProp(arguments.length >= 1 ? prop(def) : prop(), stringAsDate, true)
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
  return transformedProp(
    arguments.length >= 2 ? tProp(typeOrDefaultValue, def) : tProp(typeOrDefaultValue),
    stringAsDate,
    true
  )
}
