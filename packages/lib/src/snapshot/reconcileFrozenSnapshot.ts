import { Frozen, frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { registerReconciler } from "./reconcileSnapshot"
import type { SnapshotInOfFrozen } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function reconcileFrozenSnapshot(value: any, sn: SnapshotInOfFrozen<Frozen<any>>): Frozen<any> {
  // reconciliation is only possible if the target is a Frozen instance with the same data (by ref)
  // in theory we could compare the JSON representation of both datas or do a deep comparison, but that'd be too slow
  if (value instanceof Frozen && value.data === sn.data) {
    return value
  }
  return frozen(sn.data)
}

/**
 * @internal
 */
export function registerFrozenSnapshotReconciler() {
  registerReconciler(SnapshotterAndReconcilerPriority.Frozen, (value, sn) => {
    if (isFrozenSnapshot(sn)) {
      return reconcileFrozenSnapshot(value, sn)
    }
    return undefined
  })
}
