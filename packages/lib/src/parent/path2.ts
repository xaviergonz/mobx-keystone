import { assertTweakedObject } from "../tweaker/core"
import { getDeepObjectChildren } from "./coreObjectChildren"

/**
 * Returns if the target is a "child" of the tree of the given "parent" object.
 *
 * @param child Target object.
 * @param parent Parent object.
 * @returns
 */
export function isChildOfParent(child: object, parent: object): boolean {
  assertTweakedObject(child, "child")
  assertTweakedObject(parent, "parent")

  return getDeepObjectChildren(parent).deep.has(child)
}

/**
 * Returns if the target is a "parent" that has in its tree the given "child" object.
 *
 * @param parent Target object.
 * @param child Child object.
 * @returns
 */
export function isParentOfChild(parent: object, child: object): boolean {
  return isChildOfParent(child, parent)
}
