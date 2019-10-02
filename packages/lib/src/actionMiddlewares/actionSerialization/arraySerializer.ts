import { IObservableArray } from "mobx"
import { isArray } from "../../utils"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const arraySerializer: ActionCallArgumentSerializer<any[] | IObservableArray<any>, any[]> = {
  id: "mobx-keystone/array",

  serialize(value, _, serialize) {
    if (!isArray(value)) return cannotSerialize

    // this will also transform observable arrays into non observable ones
    return value.map(serialize)
  },

  deserialize(arr, _, deserialize) {
    return arr.map(deserialize)
  },
}
