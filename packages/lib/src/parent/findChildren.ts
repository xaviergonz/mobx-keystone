import { getChildrenObjects } from "./getChildrenObjects"

/**
 * Iterates through all children and collects them in a set if the
 * given predicate matches.
 *
 * @param root Root object to get the matching children from.
 * @param predicate Function that will be run for every child of the root object.
 * @returns A readonly observable set with the matching children.
 */
export function findChildren<T extends object = any>(
  root: object,
  predicate: (node: object) => boolean
): ReadonlySet<T> {
  const children = getChildrenObjects(root, { deep: true })

  const set = new Set<any>()

  const iter = children.values()
  let cur = iter.next()
  while (!cur.done) {
    if (predicate(cur.value)) {
      set.add(cur.value)
    }
    cur = iter.next()
  }

  return set
}
