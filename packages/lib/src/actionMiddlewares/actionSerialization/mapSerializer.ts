import { isObservableMap, ObservableMap } from "mobx"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const mapSerializer: ActionCallArgumentSerializer<
  Map<any, any> | ObservableMap<any, any>,
  [any, any][]
> = {
  id: "mobx-keystone/mapAsArray",

  serialize(map, _, serialize) {
    if (!(map instanceof Map) && !isObservableMap(map)) return cannotSerialize

    const arr: [any, any][] = []

    const iter = map.keys()
    let cur = iter.next()
    while (!cur.done) {
      const k = cur.value
      const v = map.get(k)
      arr.push([serialize(k), serialize(v)])
      cur = iter.next()
    }

    return arr
  },

  deserialize(arr, _, deserialize) {
    const map = new Map()

    const len = arr.length
    for (let i = 0; i < len; i++) {
      const k = arr[i][0]
      const v = arr[i][1]
      map.set(deserialize(k), deserialize(v))
    }

    return map
  },
}
