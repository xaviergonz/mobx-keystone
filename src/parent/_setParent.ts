import { isTweakedObject } from "../tweaker"
import { isObject } from "../_utils"
import { getParentPath, ParentPath } from "./core"
import { parentPathEquals, getObjectParents } from "./_internal"

export type SetParentResult =
  | {
      oldParentPath: ParentPath<any> | undefined
      newParentPath: ParentPath<any> | undefined
      changed: boolean
    }
  | "primitive"

export function setParent(value: any, parentPath: ParentPath<any> | undefined): SetParentResult {
  if (!isObject(value)) {
    return "primitive"
  }

  if (process.env.NODE_ENV !== "production") {
    if (!isTweakedObject(value)) {
      throw fail(`assertion failed: value is not ready to take a parent`)
    }
    if (parentPath) {
      if (!isTweakedObject(parentPath.parent)) {
        throw fail(`assertion failed: parent is not ready to take children`)
      }
    }
  }

  const oldParentPath = getParentPath(value)
  if (parentPathEquals(oldParentPath, parentPath)) {
    return {
      newParentPath: parentPath,
      oldParentPath,
      changed: false,
    }
  }

  if (oldParentPath && parentPath) {
    throw fail("an object cannot be assigned a new parent when it already has one")
  }

  getObjectParents().set(value, parentPath)
  return {
    newParentPath: parentPath,
    oldParentPath,
    changed: true,
  }
}
