import { isTweakedObject } from "../tweaker/core"
import { isArray, isPlainObject, isPrimitive } from "../utils"
import type { CloneOptions } from "./clone"
import { clone } from "./clone"
import { fromSnapshot } from "./fromSnapshot"

/**
 * Clones non-primitive tree-compatible values.
 * Intended to be used with `withSetter(cloneTreeValue)`.
 */
export function cloneTreeValue<T>(value: T, options?: Partial<CloneOptions>): T {
  const cloneOptions: CloneOptions = {
    generateNewIds: true,
    ...options,
  }

  if (isPrimitive(value)) {
    return value
  }

  if (isTweakedObject(value, false)) {
    return clone(value, cloneOptions) as T
  }

  if (isArray(value) || isPlainObject(value)) {
    return fromSnapshot(value as any, cloneOptions) as T
  }

  return value
}
