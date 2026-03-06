import type { ObservableSet } from "mobx"
import type { ModelPropTransform } from "../modelShared/prop"
import { asSet } from "../wrappers/asSet"

const _arrayToSetTransform: ModelPropTransform<Array<unknown>, ObservableSet<unknown>> = {
  transform({ originalValue: arr, cachedTransformedValue: cachedSet }) {
    return cachedSet ?? asSet(arr)
  },

  untransform({ transformedValue: set }) {
    // do not cache set <-> arr relationship

    return Array.from(set.values())
  },
}

/**
 * @deprecated Prefer the codec equivalent: `tProp(types.setFromArray(valueType))`.
 * Use `tProp(types.skipCheck(types.setFromArray(valueType)))` if you don't need runtime validation.
 */
export const arrayToSetTransform = <T>() =>
  _arrayToSetTransform as ModelPropTransform<Array<T>, Set<T> | ObservableSet<T>>
