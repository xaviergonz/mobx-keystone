import { assertIsObject } from "../utils"
import { typesOr } from "./or"
import { typesLiteral } from "./primitives"
import { IdentityType } from "./schemas"

function enumValues(e: any): (string | number)[] {
  const vals = []
  for (const k of Object.keys(e)) {
    const v = e[k]
    // we have to do this since TS does something weird
    // to number values
    // Hi = 0 -> { Hi: 0, 0: "Hi" }
    if (typeof v !== "string" || e[v] !== +k) {
      vals.push(v)
    }
  }
  return vals
}

/**
 * An enum type, based on a Typescript alike enum object.
 * Syntactic sugar for `types.or(...enum_values.map(types.literal))`
 *
 * Example:
 * ```ts
 * enum Color {
 *   Red = "red",
 *   Green = "green"
 * }
 *
 * const colorType = types.enum<Color>(Color)
 * ```
 *
 * @template E Enum type.
 * @param enumObject
 * @returns
 */
export function typesEnum<E = never>(enumObject: object): IdentityType<E> {
  assertIsObject(enumObject, "enumObject")

  const literals = enumValues(enumObject).map(e => typesLiteral(e))
  return typesOr(...literals) as any
}
