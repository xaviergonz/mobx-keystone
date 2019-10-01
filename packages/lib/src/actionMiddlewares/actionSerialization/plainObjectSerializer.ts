import { isObservableObject } from "mobx"
import { isPlainObject } from "../../utils"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const plainObjectSerializer: ActionCallArgumentSerializer<object, object> = {
  id: "mobx-keystone/plainObject",

  serialize(value, _, serialize) {
    if (!isPlainObject(value) && !isObservableObject(value)) return cannotSerialize

    // this will make observable objects non observable ones
    return mapObjectFields(value, serialize)
  },

  deserialize(obj, _, serialize) {
    return mapObjectFields(obj, serialize)
  },
}

function mapObjectFields(originalObj: any, mapFn: (x: any) => any): any {
  const obj: any = {}
  const keys = Object.keys(originalObj)
  const len = keys.length
  for (let i = 0; i < len; i++) {
    const k = keys[i]
    const v = originalObj[k]
    obj[k] = mapFn(v)
  }
  return obj
}
