import { ObservableSet } from "mobx"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const setSerializer: ActionCallArgumentSerializer<Set<any> | ObservableSet<any>, any[]> = {
  id: "mobx-keystone/setAsArray",

  serialize(set, _, serialize) {
    if (!(set instanceof Set)) return cannotSerialize

    const arr: any[] = []

    const iter = set.keys()
    let cur = iter.next()
    while (!cur.done) {
      const k = cur.value
      arr.push(serialize(k))
      cur = iter.next()
    }

    return arr
  },

  deserialize(arr, _, deserialize) {
    const set = new Set()

    const len = arr.length
    for (let i = 0; i < len; i++) {
      const k = arr[i]
      set.add(deserialize(k))
    }

    return set
  },
}
