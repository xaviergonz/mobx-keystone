import { isObject } from "../_utils"
import { getParentPath } from "./core"
import { isObservableArray, isObservableObject } from "mobx"

export function detach(value: object) {
  if (!isObject(value)) {
    throw fail("only objects can be detached")
  }

  const parentPath = getParentPath(value)
  if (!parentPath) return

  const { parent, path } = parentPath
  if (isObservableArray(parent)) {
    parent.splice(+path, 1)
  } else if (isObservableObject(parent)) {
    ;(parent as any)[path] = undefined
  } else {
    throw fail("parent must be an observable object or an observable array")
  }
}
