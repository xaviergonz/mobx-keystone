import { action } from "mobx"
import { enqueuePendingAction } from "../action/pendingActions"
import { BaseModel } from "../model/BaseModel"
import { getModelMetadata } from "../model/getModelMetadata"
import { isModel } from "../model/utils"
import { attachToRootStore, detachFromRootStore } from "../rootStore/attachDetach"
import { isRootStore } from "../rootStore/rootStore"
import { clone } from "../snapshot/clone"
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
 * @internal
 */
export const setParent = action(
  "setParent",
  ({
    value,
    parentPath,
    indexChangeAllowed,
    isDataObject,
    cloneIfApplicable,
  }: {
    value: any
    parentPath: ParentPath<any> | undefined
    indexChangeAllowed: boolean
    isDataObject: boolean
    cloneIfApplicable: boolean
  }): any => {
    if (isPrimitive(value)) {
      return value
    }

    if (inDevMode()) {
      if (indexChangeAllowed && cloneIfApplicable) {
        throw failure(
          "assertion failed: 'indexChangeAllowed' and 'cloneIfApplicable' cannot be set at the same time"
        )
      }
      if (typeof value === "function" || typeof value === "symbol") {
        throw failure(`assertion failed: value cannot be a function or a symbol`)
      }
      if (!isTweakedObject(value, true)) {
        throw failure(`assertion failed: value is not ready to take a parent`)
      }
      if (parentPath && !isTweakedObject(parentPath.parent, true)) {
        throw failure(`assertion failed: parent is not ready to take children`)
      }
    }

    if (isDataObject) {
      dataObjectParent.set(value, parentPath!.parent)
      // data object will proxy to use the actual parent model for child/parent stuff
      return value
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

    let oldParentPath = fastGetParentPath(value)
    if (parentPathEquals(oldParentPath, parentPath)) {
      return value
    }

    if (isRootStore(value)) {
      throw failure("root stores cannot be attached to any parents")
    }

    // value type models should be cloned when they are about to be assigned to a new parent
    // and they had one previously
    if (
      cloneIfApplicable &&
      parentPath?.parent &&
      oldParentPath?.parent &&
      isModel(value) &&
      getModelMetadata(value).valueType
    ) {
      value = clone(value, { generateNewIds: true })
      oldParentPath = fastGetParentPath(value)
    }

    if (oldParentPath && parentPath) {
      if (oldParentPath.parent === parentPath.parent && indexChangeAllowed) {
        // just changing the index
        objectParents.set(value, parentPath)
        reportParentPathChanged(value)
        return value
      } else {
        throw failure("an object cannot be assigned a new parent when it already has one")
      }
    }

    const attachToNewParent = () => {
      // detach from old
      if (oldParentPath?.parent) {
        removeObjectChild(oldParentPath.parent, value)
      }

      // attach to new
      objectParents.set(value, parentPath)
      if (parentPath?.parent) {
        addObjectChild(parentPath.parent, value)
      }
      reportParentPathChanged(value)
    }

    if (value instanceof BaseModel) {
      const oldRoot = fastGetRoot(value)
      const oldRootStore = isRootStore(oldRoot) ? oldRoot : undefined

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
      attachToNewParent()
    }

    return value
  }
)
