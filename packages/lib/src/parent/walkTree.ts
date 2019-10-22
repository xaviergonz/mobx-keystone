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
/*
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
*/

/**
 * @ignore
 * @internal
 */
export interface ComputedWalkTreeAggregate<R> {
  walk(target: object): Map<R, object> | undefined
}

/**
 * @ignore
 * @internal
 */
export function computedWalkTreeAggregate<R>(
  predicate: (node: object) => R | undefined
): ComputedWalkTreeAggregate<R> {
  const computedFns = new WeakMap<object, IComputedValue<Map<R, object> | undefined>>()

  const getComputedTreeResult = (tree: object): Map<R, object> | undefined => {
    let cmpted = computedFns.get(tree)
    if (!cmpted) {
      cmpted = computed(() => {
        return walkTreeAggregate(tree, predicate, recurse)
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

function walkTreeAggregate<R>(
  target: object,
  rootPredicate: (node: object) => R | undefined,
  recurse: (node: object) => Map<R, object> | undefined
): Map<R, object> | undefined {
  let map: Map<R, object> | undefined
  const rootVal = rootPredicate(target)

  const childrenMap = getObjectChildren(target)!
  const childrenIter = childrenMap!.values()
  let ch = childrenIter.next()

  // small optimization, if there is only one child and this
  // object provides no value we can just reuse the child ones
  if (rootVal === undefined && childrenMap.size === 1) {
    return recurse(ch.value)
  }

  while (!ch.done) {
    const childMap = recurse(ch.value)

    if (childMap) {
      if (!map) {
        map = new Map()
      }

      // add child map keys/values to own map
      const mapIter = childMap.keys()

      let mapCur = mapIter.next()
      while (!mapCur.done) {
        const key = mapCur.value
        const val = childMap.get(key)!
        map.set(key, val)
        mapCur = mapIter.next()
      }
    }

    ch = childrenIter.next()
  }

  // add it at the end so parent resolutions have higher
  // priority than child ones
  if (rootVal !== undefined) {
    if (!map) {
      map = new Map()
    }
    map.set(rootVal, target)
  }

  return map
}
