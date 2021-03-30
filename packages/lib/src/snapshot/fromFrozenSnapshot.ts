import { frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { registerSnapshotter } from "./fromSnapshot"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

registerSnapshotter(SnapshotterAndReconcilerPriority.Frozen, (sn) => {
  if (isFrozenSnapshot(sn)) {
    return frozen(sn.data)
  }
  return undefined
})
