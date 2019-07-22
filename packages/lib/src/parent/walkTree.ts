import { assertTweakedObject } from "../tweaker/core"
import { getChildrenObjects } from "./getChildrenObjects"

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
 * @param subtreeRoot Subtree root object.
 * @param predicate Function that will be run for each node of the tree.
 * @param mode Mode to walk the tree, as defined in `WalkTreeMode`.
 * @returns
 */
export function walkTree<T = void>(
  subtreeRoot: object,
  predicate: (node: any) => T | undefined,
  mode: WalkTreeMode
): T | undefined {
  assertTweakedObject(subtreeRoot, "target")

  if (mode === WalkTreeMode.ParentFirst) {
    const ret = predicate(subtreeRoot)
    if (ret !== undefined) {
      return ret
    }
  }

  const children = getChildrenObjects(subtreeRoot)
  for (const ch of children) {
    const ret = walkTree(ch, predicate, mode)
    if (ret !== undefined) {
      return ret
    }
  }

  if (mode === WalkTreeMode.ChildrenFirst) {
    const ret = predicate(subtreeRoot)
    if (ret !== undefined) {
      return ret
    }
  }

  return undefined
}
