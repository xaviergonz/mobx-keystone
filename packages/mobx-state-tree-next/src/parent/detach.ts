import { isObservableArray, isObservableObject, untracked } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { getParentPath } from "./path"

/**
 * Detaches a given object from a tree.
 * If the parent is an object / model, detaching will set the property to undefined.
 * If the parent is an array detaching will remove the node by spicing it.
 * If there's no parent it will throw.
 *
 * @export
 * @param value Object to be detached.
 */
export function detach(value: object) {
  // untracked because it shouldn't track, but it should be inside
  // an action
  return untracked(() => {
    assertTweakedObject(value, "detach")

    const parentPath = getParentPath(value)
    if (!parentPath) return

    const { parent, path } = parentPath
    if (isObservableArray(parent)) {
      parent.splice(+path, 1)
    } else if (isObservableObject(parent)) {
      ;(parent as any)[path] = undefined
    } else {
      throw failure("parent must be an observable object or an observable array")
    }
  })
}
