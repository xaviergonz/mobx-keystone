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
      case Number.POSITIVE_INFINITY:
        return "+inf"
      case Number.NEGATIVE_INFINITY:
        return "-inf"
      default:
        break
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
        return Number.NaN
      case "+inf":
        return Number.POSITIVE_INFINITY
      case "-inf":
        return Number.NEGATIVE_INFINITY
      case "undefined":
        return undefined
      default:
        return BigInt(str)
    }
  },
}
