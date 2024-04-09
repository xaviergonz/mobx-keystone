import { assertTweakedObject } from "../tweaker/core"
import { getDeepObjectChildren, getObjectChildren } from "./coreObjectChildren"

/**
 * Returns all the children objects (this is, excluding primitives) of an object.
 *
 * @param node Object to get the list of children from.
 * @param [options] An optional object with the `deep` option (defaults to false) to true to get
 * the children deeply or false to get them shallowly.
 * @returns A readonly observable set with the children.
 */
export function getChildrenObjects(
  node: object,
  options?: {
    deep?: boolean
  }
): ReadonlySet<object> {
  assertTweakedObject(node, "node")

  if (!options?.deep) {
    return getObjectChildren(node)
  } else {
    return getDeepObjectChildren(node).deep
  }
}
