import { AnyFunction } from "../utils/AnyFunction"

/**
 * @internal
 */
export const modelActionSymbol = Symbol("modelAction")

/**
 * Returns if the given function is a model action or not.
 *
 * @param fn Function to check.
 * @returns
 */
export function isModelAction(fn: AnyFunction): boolean {
  return typeof fn === "function" && modelActionSymbol in fn
}
