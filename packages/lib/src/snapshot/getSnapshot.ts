import { assertTweakedObject } from "../tweaker/core"
import { failure, isPrimitive } from "../utils"
import { getInternalSnapshot, reportInternalSnapshotObserved } from "./internal"
import { SnapshotOutOf } from "./SnapshotOf"

/**
 * Retrieves an immutable snapshot for a data structure.
 * Since returned snapshots are immutable they will respect shallow equality, this is,
 * if no changes are made then the snapshot will be kept the same.
 *
 * @typeparam T Object type.
 * @param value Data structure, including primtives.
 * @returns The snapshot.
 */
export function getSnapshot<T>(value: T): SnapshotOutOf<T> {
  if (isPrimitive(value)) {
    return value as any
  }

  assertTweakedObject(value, "getSnapshot")

  const snapshot = getInternalSnapshot(value as any)
  if (!snapshot) {
    throw failure("getSnapshot is not supported for this kind of object")
  }

  reportInternalSnapshotObserved(snapshot)
  return snapshot.standard
}
