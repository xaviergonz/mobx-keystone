import { isObservableSet, type ObservableSet } from "mobx"
import { namespace } from "../../utils"
import { type ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const setSerializer: ActionCallArgumentSerializer<Set<any> | ObservableSet<any>, any[]> = {
  id: `${namespace}/setAsArray`,

  serialize(set, serialize) {
    if (!(set instanceof Set || isObservableSet(set))) {
      return cannotSerialize
    }

    // Array.from closes the iterator if an element cannot be serialized.
    return Array.from(set.keys(), serialize)
  },

  deserialize(arr, deserialize) {
    const set = new Set()

    const len = arr.length
    for (let i = 0; i < len; i++) {
      const k = arr[i]
      set.add(deserialize(k))
    }

    return set
  },
}
