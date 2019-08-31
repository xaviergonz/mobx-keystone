import { assertTweakedObject } from "../tweaker/core"
import { objectChildren } from "./core"
import { fastIsModelDataObject } from "./path"
import { walkTree, WalkTreeMode } from "./walkTree"

/**
 * Returns all the children objects (this is, excluding primitives) of an object.
 * Excludes model interim data objects (`$`).
 *
 * @param node Object to get the list of children from.
 * @param [options] An optional object with the `deep` option (defaults to false) to true to get
 * the children deeply or false to get them shallowly, and `includeModelDataObjects` (defaults to false)
 * to get the model interim data objects (`$`) or false not to.
 * @returns
 */
export function getChildrenObjects(
  node: object,
  options?: {
    deep?: boolean
    includeModelDataObjects?: boolean
  }
): Set<object> {
  assertTweakedObject(node, "node")

  const includeModelDataObjects = !!options && !!options.includeModelDataObjects

  if (!options || !options.deep) {
    // we return a set copy so it can be easily observed when any of the inner items change
    const set = new Set<object>()

    const iter = objectChildren.get(node)!.values()
    let cur = iter.next()
    while (!cur.done) {
      if (includeModelDataObjects || !fastIsModelDataObject(cur.value)) {
        set.add(cur.value)
      }
      cur = iter.next()
    }

    return set
  } else {
    const set = new Set<object>()

    walkTree(
      node,
      n => {
        if (includeModelDataObjects || !fastIsModelDataObject(n)) {
          set.add(n)
        }
      },
      WalkTreeMode.ParentFirst
    )

    set.delete(node)

    return set
  }
}
