import { type DeepChange, DeepChangeType } from "mobx-keystone"
import { getSnapshotValue } from "./treeUtils"

/**
 * Captures snapshots of tree nodes in a DeepChange.
 * This ensures values are captured at change time, not at apply time,
 * preventing issues when values are mutated after being added to a collection.
 */
export function captureChangeSnapshots(change: DeepChange): DeepChange {
  switch (change.type) {
    case DeepChangeType.ArraySplice:
      return change.addedValues.length > 0
        ? { ...change, addedValues: change.addedValues.map(getSnapshotValue) }
        : change
    case DeepChangeType.ArrayUpdate:
    case DeepChangeType.ObjectAdd:
    case DeepChangeType.ObjectUpdate:
      return { ...change, newValue: getSnapshotValue(change.newValue) }
    default:
      return change
  }
}
