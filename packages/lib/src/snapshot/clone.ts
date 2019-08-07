import { assertTweakedObject } from "../tweaker/core"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"

/**
 * Clones an object by doing a `fromSnapshot(getSnapshot(value))`.
 *
 * @typeparam T Object type.
 * @param node Object to clone.
 * @returns The cloned object.
 */
export function clone<T extends object>(node: T): T {
  assertTweakedObject(node, "node")

  const sn = getSnapshot(node)
  return fromSnapshot(sn as any)
}
