import { isObservableArray, isObservableObject } from "mobx"
import { BuiltInAction } from "../action/builtInActions"
import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { getParentPath } from "./path"

/**
 * Detaches a given object from a tree.
 * If the parent is an object / model, detaching will delete the property.
 * If the parent is an array detaching will remove the node by splicing it.
 * If there's no parent it will throw.
 *
 * @param node Object to be detached.
 */
export function detach(node: object): void {
  assertTweakedObject(node, "node")

  wrappedInternalDetach.call(node)
}

const wrappedInternalDetach = wrapInAction(
  BuiltInAction.Detach,
  internalDetach,
  ActionContextActionType.Sync
)

function internalDetach(this: object): void {
  const node = this

  const parentPath = getParentPath(node)
  if (!parentPath) return

  const { parent, path } = parentPath
  if (isObservableArray(parent)) {
    parent.splice(+path, 1)
  } else if (isObservableObject(parent)) {
    delete (parent as any)[path]
  } else {
    throw failure("parent must be an observable object or an observable array")
  }
}
