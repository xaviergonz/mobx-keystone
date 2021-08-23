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

export const isoStringToDateTransform = () => _isoStringToDateTransform
