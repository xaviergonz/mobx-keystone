import { assertTweakedObject } from "../tweaker/core"
import { getParentPath } from "./path"

/**
 * Iterates through all the parents (from the nearest until the root)
 * until one of them matches the given predicate.
 * If the predicate is matched it will return the found node.
 * If none is found it will return undefined.
 *
 * @typeparam T Parent object type.
 * @param node Target object.
 * @param predicate Function that will be run for every parent of the target object, from immediate parent to the root.
 * @returns
 */
export function findParent<T extends object = any>(
  node: object,
  predicate: (parentNode: object) => boolean
): T | undefined {
  assertTweakedObject(node, "node")

  let current: any = node
  let parentPath
  while ((parentPath = getParentPath(current))) {
    current = parentPath.parent
    if (predicate(current)) {
      return current
    }
  }
  return undefined
}
