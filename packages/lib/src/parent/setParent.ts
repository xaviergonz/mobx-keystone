import { action, observable } from "mobx"
import { BaseModel } from "../model/BaseModel"
import { attachToRootStore, detachFromRootStore } from "../rootStore/attachDetach"
import { isRootStore } from "../rootStore/rootStore"
import { isTweakedObject } from "../tweaker/core"
import { failure, inDevMode, isPrimitive } from "../utils"
import { objectChildren, objectParents, parentPathEquals, reportParentPathChanged } from "./core"
import { fastGetParentPath, fastGetRoot, ParentPath } from "./path"

const defaultObservableSetOptions = { deep: false }

/**
 * @ignore
 */
export const setParent = action(
  "setParent",
  (
    value: any,
    parentPath: ParentPath<any> | undefined,
    indexChangeAllowed: boolean = false
  ): void => {
    if (isPrimitive(value)) {
      return
    }

    if (inDevMode()) {
      if (typeof value === "function" || typeof value === "symbol") {
        throw failure(`assertion failed: value cannot be a function or a symbol`)
      }
      if (!isTweakedObject(value)) {
        throw failure(`assertion failed: value is not ready to take a parent`)
      }
      if (parentPath) {
        if (!isTweakedObject(parentPath.parent)) {
          throw failure(`assertion failed: parent is not ready to take children`)
        }
      }
    }

    if (!objectChildren.has(value)) {
      objectChildren.set(value, observable.set([], defaultObservableSetOptions))
    }

    const oldParentPath = fastGetParentPath(value)
    if (parentPathEquals(oldParentPath, parentPath)) {
      return
    }

    if (isRootStore(value)) {
      throw failure("root stores cannot be attached to any parents")
    }

    if (oldParentPath && parentPath) {
      if (oldParentPath.parent === parentPath.parent && indexChangeAllowed) {
        // just changing the index
        objectParents.set(value, parentPath)
        reportParentPathChanged(value)
        return
      } else {
        throw failure("an object cannot be assigned a new parent when it already has one")
      }
    }

    const removeFromOldParent = () => {
      if (oldParentPath && oldParentPath.parent) {
        const children = objectChildren.get(oldParentPath.parent)!
        children.delete(value)
      }
    }

    const attachToNewParent = () => {
      if (parentPath && parentPath.parent) {
        const children = objectChildren.get(parentPath.parent)!
        children.add(value)
      }
      objectParents.set(value, parentPath)
      reportParentPathChanged(value)
    }

    if (value instanceof BaseModel) {
      const oldRoot = fastGetRoot(value)
      const oldRootStore = isRootStore(oldRoot) ? oldRoot : undefined
      removeFromOldParent()

      attachToNewParent()
      const newRoot = fastGetRoot(value)
      const newRootStore = isRootStore(newRoot) ? newRoot : undefined

      // invoke model root store events
      if (oldRootStore !== newRootStore) {
        if (oldRootStore) {
          detachFromRootStore(value)
        }
        if (newRootStore) {
          attachToRootStore(newRootStore, value)
        }
      }
    } else {
      removeFromOldParent()
      attachToNewParent()
    }
  }
)
