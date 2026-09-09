import { type DeepChange, DeepChangeType, getSnapshot, isTreeNode } from "mobx-keystone"

/**
 * Captures snapshots of tree nodes in a DeepChange.
 * This ensures values are captured at change time, not at apply time,
 * preventing issues when values are mutated after being added to a collection.
 */
export function captureChangeSnapshots(change: DeepChange): DeepChange {
  if (change.type === DeepChangeType.ArraySplice && change.addedValues.length > 0) {
    const snapshots = change.addedValues.map((v) => (isTreeNode(v) ? getSnapshot(v) : v))
    return { ...change, addedValues: snapshots }
  } else if (change.type === DeepChangeType.ArrayUpdate) {
    const snapshot = isTreeNode(change.newValue) ? getSnapshot(change.newValue) : change.newValue
    return { ...change, newValue: snapshot }
  } else if (
    change.type === DeepChangeType.ObjectAdd ||
    change.type === DeepChangeType.ObjectUpdate
  ) {
    const snapshot = isTreeNode(change.newValue) ? getSnapshot(change.newValue) : change.newValue
    return { ...change, newValue: snapshot }
  }
  return change
}
