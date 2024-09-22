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
 * @param root Subtree root object.
 * @param visit Function that will be run for each node of the tree.
 * @param mode Mode to walk the tree, as defined in `WalkTreeMode`.
 * @returns
 */
export function walkTree<T = void>(
  root: object,
  visit: (node: object) => T | undefined,
  mode: WalkTreeMode
): T | undefined {
  assertTweakedObject(root, "root")

  if (mode === WalkTreeMode.ParentFirst) {
    return walkTreeParentFirst(root, visit)
  } else {
    return walkTreeChildrenFirst(root, visit)
  }
}

function walkTreeParentFirst<T = void>(
  root: object,
  visit: (node: object) => T | undefined
): T | undefined {
  const stack: object[] = [root]

  while (stack.length > 0) {
    const node = stack.pop()!

    const ret = visit(node)
    if (ret !== undefined) {
      return ret
    }

    const children = getObjectChildren(node)

    stack.length += children.size
    let i = stack.length - 1

    const childrenIter = children.values()
    let ch = childrenIter.next()
    while (!ch.done) {
      stack[i--] = ch.value
      ch = childrenIter.next()
    }
  }

  return undefined
}

function walkTreeChildrenFirst<T = void>(
  root: object,
  visit: (node: object) => T | undefined
): T | undefined {
  const childrenIter = getObjectChildren(root).values()
  let ch = childrenIter.next()
  while (!ch.done) {
    const ret = walkTreeChildrenFirst(ch.value, visit)
    if (ret !== undefined) {
      return ret
    }
    ch = childrenIter.next()
  }

  const ret = visit(root)
  if (ret !== undefined) {
    return ret
  }

  return undefined
}

/**
 * @internal
 */
export interface ComputedWalkTreeAggregate<R> {
  walk(target: object): Map<R, object> | undefined
}

function getComputedTreeResult<R>(
  computedFns: WeakMap<object, IComputedValue<Map<R, object> | undefined>>,
  visit: (node: object) => R | undefined,
  tree: object
): Map<R, object> | undefined {
  let cmpted = computedFns.get(tree)
  if (!cmpted) {
    cmpted = computed(() => {
      return walkTreeAggregate(tree, visit, (ch) => getComputedTreeResult(computedFns, visit, ch))
    })
    computedFns.set(tree, cmpted)
  }
  return cmpted.get()
}

/**
 * @internal
 */
export function computedWalkTreeAggregate<R>(
  visit: (node: object) => R | undefined
): ComputedWalkTreeAggregate<R> {
  const computedFns = new WeakMap<object, IComputedValue<Map<R, object> | undefined>>()

  return {
    walk: (n) => getComputedTreeResult(computedFns, visit, n),
  }
}

function walkTreeAggregate<R>(
  target: object,
  visit: (node: object) => R | undefined,
  recurse: (node: object) => Map<R, object> | undefined
): Map<R, object> | undefined {
  let map: Map<R, object> | undefined
  const rootVal = visit(target)

  const childrenMap = getObjectChildren(target)
  const childrenIter = childrenMap.values()
  let ch = childrenIter.next()

  // small optimization, if there is only one child and this
  // object provides no value we can just reuse the child ones
  if (rootVal === undefined && childrenMap.size === 1) {
    return recurse(ch.value!)
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
