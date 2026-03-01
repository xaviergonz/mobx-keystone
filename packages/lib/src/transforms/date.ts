import type { ModelPropTransform } from "../modelShared/prop"
import { ImmutableDate } from "./ImmutableDate"

const _timestampToDateTransform: ModelPropTransform<number, Date> = {
  transform({ originalValue, cachedTransformedValue }) {
    return cachedTransformedValue ?? new ImmutableDate(originalValue)
  },

  untransform({ transformedValue, cacheTransformedValue }) {
    if (transformedValue instanceof ImmutableDate) {
      cacheTransformedValue()
    }
    return +transformedValue
  },
}

/**
 * @deprecated Prefer the codec equivalent: `tProp(types.dateAsTimestamp)`.
 * Use `tProp(types.skipCheck(types.dateAsTimestamp))` if you don't need runtime validation.
 */
export const timestampToDateTransform = () => _timestampToDateTransform

const _isoStringToDateTransform: ModelPropTransform<string, Date> = {
  transform({ originalValue, cachedTransformedValue }) {
    return cachedTransformedValue ?? new ImmutableDate(originalValue)
  },

  untransform({ transformedValue, cacheTransformedValue }) {
    if (transformedValue instanceof ImmutableDate) {
      cacheTransformedValue()
    }
    return transformedValue.toISOString()
  },
}

/**
 * @deprecated Prefer the codec equivalent: `tProp(types.dateAsIsoString)`.
 * Use `tProp(types.skipCheck(types.dateAsIsoString))` if you don't need runtime validation.
 */
export const isoStringToDateTransform = () => _isoStringToDateTransform
