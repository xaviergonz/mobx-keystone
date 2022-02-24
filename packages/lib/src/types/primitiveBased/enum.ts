import { assertIsObject } from "../../utils"
import type { IdentityType } from "../schemas"
import { typesOr } from "../utility/or"
import { typesLiteral } from "./primitives"

/**
 * @ignore
 * Enum like object.
 */
export interface EnumLike {
  [k: string]: number | string
  [v: number]: string
}

/**
 * @internal
 */
export function enumValues(e: EnumLike): (string | number)[] {
  const vals: (string | number)[] = []
  for (const k of Object.keys(e)) {
    const v = e[k]
    // we have to do this since TS does something weird
    // to number values
    // Hi = 0 -> { Hi: 0, 0: "Hi" }
    // and SWC currently generates enum code inconsistent with TS/Babel
    // https://github.com/swc-project/swc/issues/3711
    if (!vals.includes(v) && ((typeof v !== "string" && v !== +k) || e[v] !== +k)) {
      vals.push(v)
    }
  }
  return vals
}

/**
 * @ignore
 * Extract enum values out of a enum object.
 */
export type EnumValues<E extends EnumLike> = E extends Record<
  infer _K, // eslint-disable-line @typescript-eslint/no-unused-vars
  infer V
>
  ? V
  : never

/**
 * An enum type, based on a TypeScript alike enum object.
 * Syntactic sugar for `types.or(...enum_values.map(types.literal))`
 *
 * Example:
 * ```ts
 * enum Color {
 *   Red = "red",
 *   Green = "green"
 * }
 *
 * const colorType = types.enum(Color)
 * ```
 *
 * @template E Enum type.
 * @param enumObject
 * @returns
 */
export function typesEnum<E extends EnumLike>(enumObject: E): IdentityType<EnumValues<E>> {
  assertIsObject(enumObject, "enumObject")

  const literals = enumValues(enumObject).map((e) => typesLiteral(e))
  return typesOr(...literals) as any
}
