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

/**
 * @deprecated Prefer the codec equivalent: `tProp(types.bigint)`.
 * Use `tProp(types.skipCheck(types.bigint))` if you don't need runtime validation.
 */
export const stringToBigIntTransform = () => _stringToBigIntTransform
