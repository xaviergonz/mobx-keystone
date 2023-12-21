import { isObservableObject, remove } from "mobx"
import { runTypeCheckingAfterChange } from "../tweaker/typeChecking"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { isPlainObject } from "../utils"
import type { ModelPool } from "../utils/ModelPool"
import { setIfDifferent } from "../utils/setIfDifferent"
import type { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { detachIfNeeded, reconcileSnapshot, registerReconciler } from "./reconcileSnapshot"

function reconcilePlainObjectSnapshot(
  value: any,
  sn: SnapshotInOfObject<any>,
  modelPool: ModelPool
): object {
  // plain obj
  if (!isPlainObject(value) && !isObservableObject(value)) {
    // no reconciliation possible
    return fromSnapshot(sn)
  }

  const plainObj = value
  const snapshotBeforeChanges = getSnapshot(plainObj)

  withoutTypeChecking(() => {
    // remove excess props
    const plainObjKeys = Object.keys(plainObj)
    const plainObjKeysLen = plainObjKeys.length
    for (let i = 0; i < plainObjKeysLen; i++) {
      const k = plainObjKeys[i]
      if (!(k in sn)) {
        remove(plainObj, k)
      }
    }

    // reconcile the rest
    const snKeys = Object.keys(sn)
    const snKeysLen = snKeys.length
    for (let i = 0; i < snKeysLen; i++) {
      const k = snKeys[i]
      const v = sn[k]

      const oldValue = plainObj[k]
      const newValue = reconcileSnapshot(oldValue, v, modelPool, plainObj, k)

      detachIfNeeded(newValue, oldValue, modelPool)

      setIfDifferent(plainObj, k, newValue)
    }
  })

  runTypeCheckingAfterChange(plainObj, undefined, snapshotBeforeChanges)

  return plainObj
}

/**
 * @internal
 */
export function registerPlainObjectSnapshotReconciler() {
  registerReconciler(SnapshotterAndReconcilerPriority.PlainObject, (value, sn, modelPool) => {
    if (isPlainObject(sn)) {
      return reconcilePlainObjectSnapshot(value, sn, modelPool)
    }
    return undefined
  })
}
