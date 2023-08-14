import { assertTweakedObject } from "../tweaker/core"
import { fastGetParent } from "./path"

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

  let currentParent = fastGetParent(child)
  while (currentParent) {
    if (currentParent === parent) {
      return true
    }

    currentParent = fastGetParent(currentParent)
  }

  return false
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
