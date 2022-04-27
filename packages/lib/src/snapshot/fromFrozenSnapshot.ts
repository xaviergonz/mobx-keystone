import { frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { registerSnapshotter } from "./fromSnapshot"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

/**
 * @internal
 */
export function registerFromFrozenSnapshotter() {
  registerSnapshotter(SnapshotterAndReconcilerPriority.Frozen, (sn) => {
    if (isFrozenSnapshot(sn)) {
      return frozen(sn.data)
    }
    return undefined
  })
}
