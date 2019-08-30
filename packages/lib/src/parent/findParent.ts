import { assertTweakedObject } from "../tweaker/core"
import { fastGetParentPath, ParentPath } from "./path"

/**
 * Iterates through all the parents (from the nearest until the root)
 * until one of them matches the given predicate.
 * If the predicate is matched it will return the found node.
 * If none is found it will return undefined.
 *
 * @typeparam T Parent object type.
 * @param child Target object.
 * @param predicate Function that will be run for every parent of the target object, from immediate parent to the root.
 * @param maxDepth Max depth, or 0 for infinite.
 * @returns
 */
export function findParent<T extends object = any>(
  child: object,
  predicate: (parentNode: object) => boolean,
  maxDepth = 0
): T | undefined {
  assertTweakedObject(child, "child")

  let current: any = child
  let depth = 0

  let parentPath: ParentPath<any> | undefined
  while ((parentPath = fastGetParentPath(current))) {
    depth++
    current = parentPath.parent
    if (predicate(current)) {
      return current
    }

    if (maxDepth > 0 && depth === maxDepth) {
      break
    }
  }
  return undefined
}
