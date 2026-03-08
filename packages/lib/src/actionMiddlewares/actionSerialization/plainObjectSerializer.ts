import { isObservableObject } from "mobx"
import { copyOwnEnumerableProps, isPlainObject, namespace } from "../../utils"
import { type ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const plainObjectSerializer: ActionCallArgumentSerializer<object, object> = {
  id: `${namespace}/plainObject`,

  serialize(value, serialize) {
    if (!(isPlainObject(value) || isObservableObject(value))) {
      return cannotSerialize
    }

    // this will make observable objects non-observable ones
    return mapObjectFields(value, serialize)
  },

  deserialize(obj, serialize) {
    return mapObjectFields(obj, serialize)
  },
}

function mapObjectFields(originalObj: any, mapFn: (x: any) => any): any {
  return copyOwnEnumerableProps({}, originalObj, mapFn)
}
