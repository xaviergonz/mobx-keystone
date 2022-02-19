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
export function isModelAction(fn: (...args: any[]) => any): boolean {
  return typeof fn === "function" && !!(fn as any)[modelActionSymbol]
}
