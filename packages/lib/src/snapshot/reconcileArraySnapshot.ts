import { set } from "mobx"
import { runTypeCheckingAfterChange } from "../tweaker/typeChecking"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { isArray } from "../utils"
import { ModelPool } from "../utils/ModelPool"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { detachIfNeeded, reconcileSnapshot, registerReconciler } from "./reconcileSnapshot"
import type { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function reconcileArraySnapshot(
  value: any,
  sn: SnapshotInOfObject<any[]>,
  modelPool: ModelPool
): any[] {
  if (!isArray(value)) {
    // no reconciliation possible
    return fromSnapshot(sn)
  }

  const snapshotBeforeChanges = getSnapshot(value)

  withoutTypeChecking(() => {
    // remove excess items
    if (value.length > sn.length) {
      value.splice(sn.length, value.length - sn.length)
    }

    // reconcile present items
    for (let i = 0; i < value.length; i++) {
      const oldValue = value[i]
      const newValue = reconcileSnapshot(oldValue, sn[i], modelPool, value)

      detachIfNeeded(newValue, oldValue, modelPool)

      set(value, i, newValue)
    }

    // add excess items
    for (let i = value.length; i < sn.length; i++) {
      value.push(reconcileSnapshot(undefined, sn[i], modelPool, value))
    }
  })

  runTypeCheckingAfterChange(value, undefined, snapshotBeforeChanges)

  return value
}

registerReconciler(SnapshotterAndReconcilerPriority.Array, (value, sn, modelPool) => {
  if (isArray(sn)) {
    return reconcileArraySnapshot(value, sn, modelPool)
  }
  return undefined
})
