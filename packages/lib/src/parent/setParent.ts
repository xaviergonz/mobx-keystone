import { action } from "mobx"
import { enqueuePendingAction } from "../action/pendingActions"
import { BaseModel } from "../model/BaseModel"
import { getModelMetadata } from "../model/getModelMetadata"
import { isModel } from "../model/utils"
import { attachToRootStore, detachFromRootStore } from "../rootStore/attachDetach"
import { fastIsRootStoreNoAtom } from "../rootStore/rootStore"
import { clone } from "../snapshot/clone"
import { isTweakedObject } from "../tweaker/core"
import { tryUntweak } from "../tweaker/tweak"
import { failure, inDevMode, isPrimitive } from "../utils"
import {
  dataObjectParent,
  dataToModelNode,
  objectParents,
  parentPathEquals,
  reportParentPathChanged,
} from "./core"
import { addObjectChild, removeObjectChild } from "./coreObjectChildren"
import { ParentPath, fastGetParentPath, fastGetRoot } from "./path"

/**
 * @internal
 */
export const setParent = action(
  "setParent",
  (
    value: any,
    parentPath: ParentPath<any> | undefined,
    indexChangeAllowed: boolean,
    isDataObject: boolean,
    cloneIfApplicable: boolean
  ): any => {
    if (isPrimitive(value)) {
      return value
    }

    if (inDevMode) {
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

    let oldParentPath = fastGetParentPath(value, false)
    if (parentPathEquals(oldParentPath, parentPath)) {
      return value
    }

    if (fastIsRootStoreNoAtom(value)) {
      throw failure("root stores cannot be attached to any parents")
    }

    if (isDataObject) {
      dataObjectParent.set(value, parentPath!.parent)
      // data object will proxy to use the actual parent model for child/parent stuff
      return value
    }

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
      oldParentPath = fastGetParentPath(value, false)
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

    const postUntweaker = parentPath ? undefined : tryUntweak(value)

    const valueIsModel = value instanceof BaseModel

    let oldRoot: any
    let oldRootStore: any
    if (valueIsModel) {
      oldRoot = fastGetRoot(value, false)
      oldRootStore = fastIsRootStoreNoAtom(oldRoot) ? oldRoot : undefined
    }

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

    if (valueIsModel) {
      const newRoot = fastGetRoot(value, false)
      const newRootStore = fastIsRootStoreNoAtom(newRoot) ? newRoot : undefined

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
    }

    postUntweaker?.()

    return value
  }
)
