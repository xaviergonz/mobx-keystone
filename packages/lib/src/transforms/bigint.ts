import type { ModelPropTransform } from "../modelShared/prop"

const _stringToBigIntTransform: ModelPropTransform<string, bigint> = {
  transform({ originalValue, cachedTransformedValue }) {
    return cachedTransformedValue ?? BigInt(originalValue)
  },

  untransform({ transformedValue, cacheTransformedValue }) {
    if (typeof transformedValue === "bigint") {
      cacheTransformedValue()
    }
    return transformedValue.toString()
  },
}

export const stringToBigIntTransform = () => _stringToBigIntTransform
