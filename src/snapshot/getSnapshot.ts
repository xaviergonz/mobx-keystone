import { assertTweakedObject } from "../tweaker/core"
import { failure, isObject } from "../utils"
import { getInternalSnapshot, reportInternalSnapshotObserved } from "./internal"
import { SnapshotOutOf } from "./SnapshotOf"

export function getSnapshot<T>(value: T): SnapshotOutOf<T> {
  if (!isObject(value)) {
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
