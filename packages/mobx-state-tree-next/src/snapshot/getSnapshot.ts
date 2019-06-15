import { assertTweakedObject } from "../tweaker/core"
import { failure, isPrimitive } from "../utils"
import { getInternalSnapshot, reportInternalSnapshotObserved } from "./internal"
import { SnapshotOutOf } from "./SnapshotOf"

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
