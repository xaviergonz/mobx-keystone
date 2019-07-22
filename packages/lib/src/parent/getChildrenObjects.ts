import { assertTweakedObject } from "../tweaker/core"
import { objectChildren } from "./core"

/**
 * Returns all the children objects (this is, excluding primitives) of an object.
 *
 * @param node Object to get the list of children from.
 * @returns
 */
export function getChildrenObjects(node: object): Set<any> {
  assertTweakedObject(node, "node")

  return objectChildren.get(node)!
}
