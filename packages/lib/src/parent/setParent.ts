import { action } from "mobx"
import { enqueuePendingAction } from "../action/pendingActions"
import { _BaseModel } from "../model/_BaseModel"
import { attachToRootStore, detachFromRootStore } from "../rootStore/attachDetach"
import { isRootStore } from "../rootStore/rootStore"
import { isTweakedObject } from "../tweaker/core"
import { failure, inDevMode, isPrimitive } from "../utils"
import {
  dataObjectParent,
  dataToModelNode,
  objectParents,
  parentPathEquals,
  reportParentPathChanged,
} from "./core"
import { addObjectChild, initializeObjectChildren, removeObjectChild } from "./coreObjectChildren"
import { fastGetParentPath, fastGetRoot, ParentPath } from "./path"

/**
 * @ignore
 * @internal
 */
export const setParent = action(
  "setParent",
  (
    value: any,
    parentPath: ParentPath<any> | undefined,
    indexChangeAllowed: boolean,
    isDataObject: boolean
  ): void => {
    if (isPrimitive(value)) {
      return
    }

    if (inDevMode()) {
      if (typeof value === "function" || typeof value === "symbol") {
        throw failure(`assertion failed: value cannot be a function or a symbol`)
      }
      if (!isTweakedObject(value, true)) {
        throw failure(`assertion failed: value is not ready to take a parent`)
      }
      if (parentPath) {
        if (!isTweakedObject(parentPath.parent, true)) {
          throw failure(`assertion failed: parent is not ready to take children`)
        }
      }
    }

    if (isDataObject) {
      dataObjectParent.set(value, parentPath!.parent)
      // data object will proxy to use the actual parent model for child/parent stuff
      return
    }

    initializeObjectChildren(value)

    // make sure the new parent actually points to models when we give model data objs
    if (parentPath) {
      const actualParent = dataToModelNode(parentPath.parent)
      if (parentPath.parent !== actualParent) {
        parentPath = {
          parent: actualParent,
          path: parentPath.path,
        }
      }
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
      if (oldParentPath?.parent) {
        removeObjectChild(oldParentPath.parent, value)
      }
    }

    const attachToNewParent = () => {
      objectParents.set(value, parentPath)
      if (parentPath?.parent) {
        addObjectChild(parentPath.parent, value)
      }
      reportParentPathChanged(value)
    }

    if (value instanceof _BaseModel) {
      const oldRoot = fastGetRoot(value)
      const oldRootStore = isRootStore(oldRoot) ? oldRoot : undefined
      removeFromOldParent()

      attachToNewParent()
      const newRoot = fastGetRoot(value)
      const newRootStore = isRootStore(newRoot) ? newRoot : undefined

      // invoke model root store events
      if (oldRootStore !== newRootStore && (oldRootStore || newRootStore)) {
        enqueuePendingAction(() => {
          if (oldRootStore) {
            detachFromRootStore(value)
          }
          if (newRootStore) {
            attachToRootStore(newRootStore, value)
          }
        })
      }
    } else {
      removeFromOldParent()
      attachToNewParent()
    }
  }
)
