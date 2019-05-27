import { getParentPath } from "./path"
import { isObservableArray, isObservableObject } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

export function detach(value: object) {
  assertTweakedObject(value, "detach")

  const parentPath = getParentPath(value, false)
  if (!parentPath) return

  const { parent, path } = parentPath
  if (isObservableArray(parent)) {
    parent.splice(+path, 1)
  } else if (isObservableObject(parent)) {
    ;(parent as any)[path] = undefined
  } else {
    throw failure("parent must be an observable object or an observable array")
  }
}
