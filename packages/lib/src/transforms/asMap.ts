import type { ModelPropTransform } from "../modelShared/prop"
import { asMap } from "../wrappers/asMap"

const _objectToMapTransform: ModelPropTransform<Record<string, unknown>, Map<string, unknown>> = {
  transform({ originalValue: obj, cachedTransformedValue: cachedMap }) {
    return cachedMap ?? asMap(obj)
  },

  untransform({ transformedValue: map }) {
    // do not cache map <-> obj relationship

    const obj: Record<string, unknown> = {}
    for (const k of map.keys()) {
      obj[k] = map.get(k)!
    }

    return obj
  },
}

export const objectToMapTransform = <T>() =>
  _objectToMapTransform as ModelPropTransform<Record<string, T>, Map<string, T>>

const _arrayToMapTransform: ModelPropTransform<Array<[unknown, unknown]>, Map<unknown, unknown>> = {
  transform({ originalValue: arr, cachedTransformedValue: cachedMap }) {
    return cachedMap ?? asMap(arr)
  },

  untransform({ transformedValue: map }) {
    // do not cache map <-> arr relationship

    const arr: Array<[unknown, unknown]> = []
    for (const k of map.keys()) {
      arr.push([k, map.get(k)!])
    }

    return arr
  },
}

export const arrayToMapTransform = <K, V>() =>
  _arrayToMapTransform as ModelPropTransform<Array<[K, V]>, Map<K, V>>
