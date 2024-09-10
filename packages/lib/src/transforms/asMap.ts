import type { ModelPropTransform } from "../modelShared/prop"
import { asMap } from "../wrappers/asMap"

const _objectToMapTransform: ModelPropTransform<Record<string, unknown>, Map<string, unknown>> = {
  transform({ originalValue: obj, cachedTransformedValue: cachedMap }) {
    return cachedMap ?? (asMap(obj) as unknown as Map<string, unknown>)
  },

  untransform({ transformedValue: map }) {
    // do not cache map <-> obj relationship

    const obj: Record<string, unknown> = {}
    map.forEach((v, k) => {
      obj[k] = v
    })

    return obj
  },
}

export const objectToMapTransform = <T>() =>
  _objectToMapTransform as ModelPropTransform<Record<string, T>, Map<string, T>>

const _arrayToMapTransform: ModelPropTransform<Array<[unknown, unknown]>, Map<unknown, unknown>> = {
  transform: ({ originalValue: arr, cachedTransformedValue: cachedMap }) => {
    return cachedMap ?? (asMap(arr) as unknown as Map<string, unknown>)
  },

  untransform({ transformedValue: map }) {
    // do not cache map <-> arr relationship

    const arr: Array<[unknown, unknown]> = []
    map.forEach((v, k) => {
      arr.push([k, v])
    })

    return arr
  },
}

export const arrayToMapTransform = <K, V>() =>
  _arrayToMapTransform as ModelPropTransform<Array<[K, V]>, Map<K, V>>
