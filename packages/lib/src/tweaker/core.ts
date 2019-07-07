import { failure, isPrimitive } from "../utils"

/**
 * @ignore
 */
export const tweakedObjects = new WeakSet<Object>()

/**
 * @ignore
 */
export function isTweakedObject(value: any): value is Object {
  return !isPrimitive(value) && tweakedObjects.has(value)
}

/**
 * Checks if a given object is now a tree node.
 *
 * @param value Value to check.
 * @returns ture if it is a tree node, false otherwise.
 */
export function isTreeNode(value: object): boolean {
  return isTweakedObject(value)
}

/**
 * @ignore
 */
export function assertTweakedObject(value: any, fnName: string): value is Object {
  if (!isTweakedObject(value)) {
    throw failure(
      `${fnName} only works over a model or a shallow / deep child part of a model 'data' object`
    )
  }
  return true
}
