import { computed, IComputedValue } from "mobx"
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
    const recurse: (node: object) => T | undefined = child =>
      walkTreeParentFirst(child, predicate, recurse)
    return walkTreeParentFirst(target, predicate, recurse)
  } else {
    const recurse: (node: object) => T | undefined = child =>
      walkTreeChildrenFirst(child, predicate, recurse)
    return walkTreeChildrenFirst(target, predicate, recurse)
  }
}

function walkTreeParentFirst<T = void>(
  target: object,
  rootPredicate: (node: object) => T | undefined,
  recurse: (node: object) => T | undefined
): T | undefined {
  const ret = rootPredicate(target)
  if (ret !== undefined) {
    return ret
  }

  const childrenIter = getObjectChildren(target)!.values()
  let ch = childrenIter.next()
  while (!ch.done) {
    const ret = recurse(ch.value)
    if (ret !== undefined) {
      return ret
    }
    ch = childrenIter.next()
  }

  return undefined
}

function walkTreeChildrenFirst<T = void>(
  target: object,
  rootPredicate: (node: object) => T | undefined,
  recurse: (node: object) => T | undefined
): T | undefined {
  const childrenIter = getObjectChildren(target)!.values()
  let ch = childrenIter.next()
  while (!ch.done) {
    const ret = recurse(ch.value)
    if (ret !== undefined) {
      return ret
    }
    ch = childrenIter.next()
  }

  const ret = rootPredicate(target)
  if (ret !== undefined) {
    return ret
  }

  return undefined
}

/**
 * @ignore
 */
export function computedWalkTreeParentFirst<T = void>(
  predicate: (node: object) => T | undefined
): {
  walk(target: object): T | undefined
} {
  const computedFns = new WeakMap<object, IComputedValue<T | undefined>>()

  const getComputedTreeResult = (tree: object): T | undefined => {
    let cmpted = computedFns.get(tree)
    if (!cmpted) {
      cmpted = computed(() => {
        return walkTreeParentFirst(tree, predicate, recurse)
      })
      computedFns.set(tree, cmpted)
    }
    return cmpted.get()
  }

  const recurse = (ch: object) => getComputedTreeResult(ch)

  return {
    walk(target) {
      return getComputedTreeResult(target)
    },
  }
}
