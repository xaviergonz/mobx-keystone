import { assertTweakedObject } from "../tweaker/core"
import { getObjectChildren } from "./coreObjectChildren"

/**
 * Mode for the `walkTree` method.
 */
export enum WalkTreeMode {
  /**
   * The walk will be done parent (roots) first, then children.
   */
  ParentFirst = "parentFirst",
  /**
   * The walk will be done children (leafs) first, then parents.
   */
  ChildrenFirst = "childrenFirst",
}

/**
 * Walks a tree, running the predicate function for each node.
 * If the predicate function returns something other than undefined,
 * then the walk will be stopped and the function will return the returned value.
 *
 * @typeparam T Returned object type, defaults to void.
 * @param target Subtree root object.
 * @param predicate Function that will be run for each node of the tree.
 * @param mode Mode to walk the tree, as defined in `WalkTreeMode`.
 * @returns
 */
export function walkTree<T = void>(
  target: object,
  predicate: (node: object) => T | undefined,
  mode: WalkTreeMode
): T | undefined {
  assertTweakedObject(target, "target")

  if (mode === WalkTreeMode.ParentFirst) {
    return walkTreeParentFirst(target, predicate)
  } else {
    return walkTreeChildrenFirst(target, predicate)
  }
}

function walkTreeParentFirst<T = void>(
  target: object,
  predicate: (node: object) => T | undefined
): T | undefined {
  const ret = predicate(target)
  if (ret !== undefined) {
    return ret
  }

  const childrenIter = getObjectChildren(target)!.values()
  let ch = childrenIter.next()
  while (!ch.done) {
    const ret = walkTreeParentFirst(ch.value, predicate)
    if (ret !== undefined) {
      return ret
    }
    ch = childrenIter.next()
  }

  return undefined
}

function walkTreeChildrenFirst<T = void>(
  target: object,
  predicate: (node: object) => T | undefined
): T | undefined {
  const childrenIter = getObjectChildren(target)!.values()
  let ch = childrenIter.next()
  while (!ch.done) {
    const ret = walkTreeChildrenFirst(ch.value, predicate)
    if (ret !== undefined) {
      return ret
    }
    ch = childrenIter.next()
  }

  const ret = predicate(target)
  if (ret !== undefined) {
    return ret
  }

  return undefined
}
