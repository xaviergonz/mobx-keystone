import { isObservableMap, type ObservableMap } from "mobx"
import { namespace } from "../../utils"
import { type ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const mapSerializer: ActionCallArgumentSerializer<
  Map<any, any> | ObservableMap<any, any>,
  [any, any][]
> = {
  id: `${namespace}/mapAsArray`,

  serialize(map, serialize) {
    if (!(map instanceof Map || isObservableMap(map))) {
      return cannotSerialize
    }

    const arr: [any, any][] = []

    for (const [key, value] of map.entries()) {
      arr.push([serialize(key), serialize(value)])
    }

    return arr
  },

  deserialize(arr, deserialize) {
    const map = new Map()

    for (const [key, value] of arr) {
      map.set(deserialize(key), deserialize(value))
    }

    return map
  },
}
