import { registerArraySnapshotReconciler } from "./reconcileArraySnapshot"
import { registerFrozenSnapshotReconciler } from "./reconcileFrozenSnapshot"
import { registerModelSnapshotReconciler } from "./reconcileModelSnapshot"
import { registerPlainObjectSnapshotReconciler } from "./reconcilePlainObjectSnapshot"

let defaultReconcilersRegistered = false

/**
 * @internal
 */
export function registerDefaultReconcilers() {
  if (defaultReconcilersRegistered) {
    return
  }
  defaultReconcilersRegistered = true

  registerArraySnapshotReconciler()
  registerFrozenSnapshotReconciler()
  registerModelSnapshotReconciler()
  registerPlainObjectSnapshotReconciler()
}
