import { typesRefinement } from "../utility/refinement"
import { typesNumber, typesString } from "./primitives"

/**
 * A type that represents any integer number value.
 * Syntactic sugar for `types.refinement(types.number, n => Number.isInteger(n), "integer")`
 *
 * ```ts
 * types.integer
 * ```
 */
export const typesInteger = typesRefinement(typesNumber, (n) => Number.isInteger(n), "integer")

/**
 * A type that represents any string value other than "".
 * Syntactic sugar for `types.refinement(types.string, s => s !== "", "nonEmpty")`
 *
 * ```ts
 * types.nonEmptyString
 * ```
 */
export const typesNonEmptyString = typesRefinement(typesString, (s) => s !== "", "nonEmpty")
