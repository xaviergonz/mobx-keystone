import { computed, type IComputedValue } from "mobx"
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
 * @template T Returned object type, defaults to void.
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
  const stack = [{ node: root, children: getObjectChildren(root).values() }]
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    const child = frame.children.next()
    if (!child.done) {
      stack.push({ node: child.value, children: getObjectChildren(child.value).values() })
    } else {
      stack.pop()
      const ret = visit(frame.node)
      if (ret !== undefined) {
        return ret
      }
    }
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

  const children = getObjectChildren(target)

  // With one child and no local value, the child's map can be reused.
  if (rootVal === undefined && children.size === 1) {
    return recurse(children.values().next().value!)
  }

  for (const child of children) {
    const childMap = recurse(child)
    if (childMap) {
      map ??= new Map()
      for (const [key, value] of childMap) {
        map.set(key, value)
      }
    }
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
