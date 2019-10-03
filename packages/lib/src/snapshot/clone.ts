import { assertTweakedObject } from "../tweaker/core"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"

/**
 * Clone options.
 */
export interface CloneOptions {
  /**
   * Pass `true` to generate new internal ids for models rather than reusing them. (Default is `true`)
   */
  generateNewIds: boolean
}

/**
 * Clones an object by doing a `fromSnapshot(getSnapshot(value), { generateNewIds: true })`.
 *
 * @typeparam T Object type.
 * @param node Object to clone.
 * @param [options] Options.
 * @returns The cloned object.
 */
export function clone<T extends object>(node: T, options?: Partial<CloneOptions>): T {
  assertTweakedObject(node, "node")

  const opts = {
    generateNewIds: true,
    ...options,
  }

  const sn = getSnapshot(node)
  return fromSnapshot(sn, opts)
}
