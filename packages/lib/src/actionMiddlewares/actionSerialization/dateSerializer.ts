import { namespace } from "../../utils"
import { type ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const dateSerializer: ActionCallArgumentSerializer<Date, number | null> = {
  id: `${namespace}/dateAsTimestamp`,

  serialize(date) {
    if (!(date instanceof Date)) {
      return cannotSerialize
    }
    const timestamp = +date
    return Number.isNaN(timestamp) ? null : timestamp
  },

  deserialize(timestamp) {
    return new Date(timestamp === null ? Number.NaN : timestamp)
  },
}
