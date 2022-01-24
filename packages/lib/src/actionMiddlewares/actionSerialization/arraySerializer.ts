import type { IObservableArray } from "mobx"
import { isArray, namespace } from "../../utils"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const arraySerializer: ActionCallArgumentSerializer<any[] | IObservableArray<any>, any[]> = {
  id: `${namespace}/array`,

  serialize(value, serialize) {
    if (!isArray(value)) return cannotSerialize

    // this will also transform observable arrays into non-observable ones
    return value.map(serialize)
  },

  deserialize(arr, deserialize) {
    return arr.map(deserialize)
  },
}
