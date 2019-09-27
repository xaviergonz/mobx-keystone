import { isObservableObject } from "mobx"
import { BuiltInAction } from "../action/builtInActions"
import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { isFrozenSnapshot } from "../frozen/Frozen"
import { modelTypeKey } from "../model/metadata"
import { getModelInfoForName } from "../model/modelInfo"
import { isModelSnapshot } from "../model/utils"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsObject, failure, inDevMode, isArray, isPlainObject } from "../utils"
import { reconcileSnapshot } from "./reconcileSnapshot"
import { SnapshotOutOf } from "./SnapshotOf"

/**
 * Applies a full snapshot over an object, reconciling it with the current contents of the object.
 *
 * @typeparam T Object type.
 * @param node Target object (model object, object or array).
 * @param snapshot Snapshot to apply.
 */
export function applySnapshot<T extends object>(node: T, snapshot: SnapshotOutOf<T>): void {
  assertTweakedObject(node, "node")
  assertIsObject(snapshot, "snapshot")

  wrappedInternalApplySnapshot.call(node, snapshot)
}

function internalApplySnapshot<T extends object>(this: T, sn: SnapshotOutOf<T>): void {
  const obj = this

  const reconcile = () => {
    const ret = reconcileSnapshot(obj, sn)

    if (inDevMode()) {
      if (ret !== obj) {
        throw failure("assertion error: reconciled object has to be the same")
      }
    }
  }

  if (isArray(sn)) {
    if (!isArray(obj)) {
      throw failure("if the snapshot is an array the target must be an array too")
    }

    return reconcile()
  }

  if (isFrozenSnapshot(sn)) {
    throw failure("applySnapshot can not be used over frozen objects")
  }

  if (isModelSnapshot(sn)) {
    const type = sn[modelTypeKey]

    const modelInfo = getModelInfoForName(type)
    if (!modelInfo) {
      throw failure(`model with name "${type}" not found in the registry`)
    }

    if (!(obj instanceof modelInfo.class) || obj[modelTypeKey] !== type) {
      // different kind of model, no reconciliation possible
      throw failure("snapshot model type does not match target model type")
    }

    return reconcile()
  }

  if (isPlainObject(sn)) {
    if (!isPlainObject(obj) && !isObservableObject(obj)) {
      // no reconciliation possible
      throw failure("if the snapshot is an object the target must be an object too")
    }

    return reconcile()
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

const wrappedInternalApplySnapshot = wrapInAction(
  BuiltInAction.ApplySnapshot,
  internalApplySnapshot,
  ActionContextActionType.Sync
)
