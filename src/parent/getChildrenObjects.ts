import { assertTweakedObject } from "../tweaker/core"
import { objectChildren } from "./core"

/**
 * Returns all the children objects (this is, excluding primitives) of an object.
 *
 * @export
 * @param target Object to get the list of children from.
 * @returns
 */
export function getChildrenObjects(target: object): Set<any> {
  assertTweakedObject(target, "getChildrenObjects")

  return objectChildren.get(target)!
}
