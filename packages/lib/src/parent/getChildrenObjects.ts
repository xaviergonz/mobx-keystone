import { assertTweakedObject } from "../tweaker/core"
import { objectChildren } from "./core"
import { walkTree, WalkTreeMode } from "./walkTree"

/**
 * Returns all the children objects (this is, excluding primitives) of an object.
 *
 * @param node Object to get the list of children from.
 * @param [options] An optional object with the `deep` option (defaults to false) to true to get
 * the children deeply or false to get them shallowly.
 * @returns
 */
export function getChildrenObjects(
  node: object,
  options?: {
    deep?: boolean
  }
): Set<object> {
  assertTweakedObject(node, "node")

  if (!options || !options.deep) {
    // we return a set copy so it can be easily observed when any of the inner items change
    return new Set<object>(objectChildren.get(node)!)
  } else {
    const set = new Set<object>()

    walkTree(
      node,
      n => {
        set.add(n)
      },
      WalkTreeMode.ParentFirst
    )

    set.delete(node)

    return set
  }
}
