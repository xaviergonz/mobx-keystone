import { assertTweakedObject } from "../tweaker/core"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"

/**
 * Options for `clone`.
 */
export interface CloneOptions {
  /**
   * If set to true (the default is true) then Models will have brand new IDs, and
   * references will fix their target IDs accordingly.
   */
  generateNewIds?: boolean
}

/**
 * Clones an object by doing a `fromSnapshot(getSnapshot(value), { generateNewIds: true })`.
 * If options has `generateNewIds` set to true (the default) then Models will have brand new IDs, and
 * references will fix their target IDs accordingly.
 *
 * @typeparam T Object type.
 * @param value Object to clone.
 * @param [options] Clone options.
 * @returns The cloned object.
 */
export function clone<T extends object>(value: T, options?: CloneOptions): T {
  assertTweakedObject(value, "clone")
  const opts = {
    generateNewIds: true,
    ...options,
  }

  const sn = getSnapshot(value)
  return fromSnapshot(sn as any, opts)
}
