import { assertTweakedObject } from "../tweaker/core"
import { getParentPath } from "./path"

/**
 * Iterates through all the parents (from the nearest until the root)
 * until one of them matches the given predicate.
 * If the predicate is matched it will return the found node.
 * If none is found it will return undefined.
 *
 * @export
 * @template T
 * @param child Target object.
 * @param predicate Function that will be run for every parent of the target object, from immediate parent to the root.
 * @returns
 */
export function findParent<T extends object = any>(
  child: object,
  predicate: (parent: any) => boolean
): T | undefined {
  assertTweakedObject(child, "findParent")

  let current: any = child
  let parentPath
  while ((parentPath = getParentPath(current))) {
    current = parentPath.parent
    if (predicate(current)) {
      return current
    }
  }
  return undefined
}
