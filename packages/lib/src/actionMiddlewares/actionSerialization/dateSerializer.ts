import { namespace } from "../../utils"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const dateSerializer: ActionCallArgumentSerializer<Date, number> = {
  id: `${namespace}/dateAsTimestamp`,

  serialize(date) {
    if (!(date instanceof Date)) {
      return cannotSerialize
    }
    return +date
  },

  deserialize(timestamp) {
    return new Date(timestamp)
  },
}
