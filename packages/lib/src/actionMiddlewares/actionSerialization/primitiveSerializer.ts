import { namespace } from "../../utils"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

export const primitiveSerializer: ActionCallArgumentSerializer<
  number | bigint | undefined,
  string
> = {
  id: `${namespace}/primitiveAsString`,

  serialize(value) {
    // number
    if (Number.isNaN(value)) {
      return "nan"
    }
    switch (value) {
      case +Infinity:
        return "+inf"
      case -Infinity:
        return "-inf"
    }

    // bigint
    if (typeof value === "bigint") {
      return value.toString()
    }

    // undefined
    if (value === undefined) {
      return "undefined"
    }

    return cannotSerialize
  },

  deserialize(str) {
    switch (str) {
      case "nan":
        return NaN
      case "+inf":
        return +Infinity
      case "-inf":
        return -Infinity
      case "undefined":
        return undefined
      default:
        return BigInt(str)
    }
  },
}
