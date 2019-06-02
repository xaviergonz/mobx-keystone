import { isObservableObject } from "mobx"
import { wrapInAction } from "../action/modelAction"
import { getModelInfoForName } from "../model/modelInfo"
import { assertTweakedObject } from "../tweaker/core"
import { failure, isArray, isModelSnapshot, isObject, isPlainObject } from "../utils"
import { modelIdKey, typeofKey } from "./metadata"
import { reconcileSnapshot } from "./reconcileSnapshot"
import { SnapshotOutOf } from "./SnapshotOf"

export const applySnapshotName = "$$applySnapshot"

/**
 * Applies a full snapshot over an object, reconciling it with the current contents of the object.
 *
 * @typeparam T Object type.
 * @param obj Target object (model object, object or array).
 * @param sn Snapshot to apply.
 */
export function applySnapshot<T extends object>(obj: T, sn: SnapshotOutOf<T>): void {
  assertTweakedObject(obj, "applySnapshot")

  if (!isObject(sn)) {
    throw failure("snapshot must be an array or object")
  }

  wrappedInternalApplySnapshot.call(obj, sn)
}

function internalApplySnapshot<T extends object>(this: T, sn: SnapshotOutOf<T>): void {
  const obj = this

  const reconcile = () => {
    const ret = reconcileSnapshot(obj, sn)

    if (process.env.NODE_ENV !== "production") {
      if (ret !== obj) {
        throw failure("assertion error: reconciled object have been the same")
      }
    }
  }

  if (isArray(sn)) {
    if (!isArray(obj)) {
      throw failure("if the snapshot is an array the target must be an array too")
    }

    return reconcile()
  }

  if (isModelSnapshot(sn)) {
    // a model
    const type = (sn as any)[typeofKey]
    const id = (sn as any)[modelIdKey]

    const modelInfo = getModelInfoForName(type)
    if (!modelInfo) {
      throw failure(`model with name "${type}" not found in the registry`)
    }

    if (!(obj instanceof modelInfo.class) || obj[typeofKey] !== type || obj[modelIdKey] !== id) {
      // different kind of model, no reconciliation possible
      throw failure("snapshot model type does not match target model type")
    }

    return reconcile()
  }

  if (isPlainObject(sn)) {
    // plain obj
    if (!isPlainObject(obj) && !isObservableObject(obj)) {
      // no reconciliation possible
      throw failure("if the snapshot is an object the target must be an object too")
    }

    return reconcile()
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

const wrappedInternalApplySnapshot = wrapInAction(applySnapshotName, internalApplySnapshot)
