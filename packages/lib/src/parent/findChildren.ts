import { getChildrenObjects } from "./getChildrenObjects"

/**
 * Iterates through all children and collects them in a set if the
 * given predicate matches.
 *
 * @param root Root object to get the matching children from.
 * @param predicate Function that will be run for every child of the root object.
 * @param [options] An optional object with the `deep` option (defaults to `false`) set to `true` to
 * get the children deeply or `false` to get them shallowly.
 * @returns A readonly observable set with the matching children.
 */
export function findChildren<T extends object = any>(
  root: object,
  predicate: (node: object) => boolean,
  options?: {
    deep?: boolean
  }
): ReadonlySet<T> {
  const children = getChildrenObjects(root, options)

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
