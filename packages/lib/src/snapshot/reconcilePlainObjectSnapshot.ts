import { isObservableObject, remove, set } from "mobx"
import { runTypeCheckingAfterChange } from "../tweaker/typeChecking"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { isPlainObject } from "../utils"
import type { ModelPool } from "../utils/ModelPool"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { detachIfNeeded, reconcileSnapshot, registerReconciler } from "./reconcileSnapshot"
import type { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

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
      const newValue = reconcileSnapshot(oldValue, v, modelPool, plainObj)

      detachIfNeeded(newValue, oldValue, modelPool)

      set(plainObj, k, newValue)
    }
  })

  runTypeCheckingAfterChange(plainObj, undefined, snapshotBeforeChanges)

  return plainObj
}

registerReconciler(SnapshotterAndReconcilerPriority.PlainObject, (value, sn, modelPool) => {
  if (isPlainObject(sn)) {
    return reconcilePlainObjectSnapshot(value, sn, modelPool)
  }
  return undefined
})
