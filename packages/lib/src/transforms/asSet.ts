import { ModelPropTransform } from "../modelShared/prop"
import { asSet } from "../wrappers/asSet"

const _arrayToSetTransform: ModelPropTransform<Array<unknown>, Set<unknown>> = {
  transform({ originalValue: arr, cachedTransformedValue: cachedSet }) {
    return cachedSet ?? asSet(arr)
  },

  untransform({ transformedValue: set }) {
    // do not cache set <-> arr relationship

    return Array.from(set.values())
  },
}

export const arrayToSetTransform = <T>() =>
  _arrayToSetTransform as ModelPropTransform<Array<T>, Set<T>>
