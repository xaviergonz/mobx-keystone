import { isModel } from "../model/utils"
import { getSnapshot } from "../snapshot/getSnapshot"
import { getObjectChildren } from "./coreObjectChildren"

/**
 * @ignore
 *
 * Like walkTree parent first mode, except that it won't revisit deeply unchanged nodes
 * and will cache any results for that tree branch.
 * Used to search (e.g., resolve IDs).
 */
export function optimizedWalkTreeSearch<T = void>(
  target: object,
  alreadyVisited: WeakMap<object, T | undefined>,
  predicate: (node: object) => T | undefined
): T | undefined {
  let realTarget = target
  if (isModel(target)) {
    realTarget = target.$
  }

  const targetSn = getSnapshot(realTarget)
  if (alreadyVisited.has(targetSn)) {
    return alreadyVisited.get(targetSn)
  }

  const ret = predicate(target)
  alreadyVisited.set(targetSn, ret)
  if (ret !== undefined) {
    return ret
  }

  const childrenIter = getObjectChildren(realTarget)!.values()
  let cur = childrenIter.next()
  while (!cur.done) {
    const child = cur.value
    const ret = optimizedWalkTreeSearch(child, alreadyVisited, predicate)
    if (ret !== undefined) {
      return ret
    }
    cur = childrenIter.next()
  }

  return undefined
}
