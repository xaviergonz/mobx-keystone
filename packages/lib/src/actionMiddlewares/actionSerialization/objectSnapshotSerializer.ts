import { fromSnapshot } from "../../snapshot/fromSnapshot"
import { getSnapshot } from "../../snapshot/getSnapshot"
import { isTweakedObject } from "../../tweaker/core"
import { namespace } from "../../utils"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const objectSnapshotSerializer: ActionCallArgumentSerializer<object, object> = {
  id: `${namespace}/objectSnapshot`,

  serialize(value) {
    if (typeof value !== "object" || value === null || !isTweakedObject(value, false))
      return cannotSerialize

    return getSnapshot(value)
  },

  deserialize(snapshot) {
    return fromSnapshot(snapshot)
  },
}
