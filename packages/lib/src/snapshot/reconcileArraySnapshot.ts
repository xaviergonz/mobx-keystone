import { runTypeCheckingAfterChange } from "../tweaker/typeChecking"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { isArray } from "../utils"
import { withErrorPathSegment } from "../utils/errorDiagnostics"
import { ModelPool } from "../utils/ModelPool"
import { setIfDifferent } from "../utils/setIfDifferent"
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
      const newValue = withErrorPathSegment(i, () =>
        reconcileSnapshot(oldValue, sn[i], modelPool, value)
      )

      detachIfNeeded(newValue, oldValue, modelPool)

      setIfDifferent(value, i, newValue)
    }

    // add excess items
    for (let i = value.length; i < sn.length; i++) {
      const newValue = withErrorPathSegment(i, () =>
        reconcileSnapshot(undefined, sn[i], modelPool, value)
      )

      detachIfNeeded(newValue, undefined, modelPool)

      value.push(newValue)
    }
  })

  runTypeCheckingAfterChange(value, undefined, snapshotBeforeChanges)

  return value
}

/**
 * @internal
 */
export function registerArraySnapshotReconciler() {
  registerReconciler(SnapshotterAndReconcilerPriority.Array, (value, sn, modelPool) => {
    if (isArray(sn)) {
      return reconcileArraySnapshot(value, sn, modelPool)
    }
    return undefined
  })
}
