import { SnapshotOf } from "./SnapshotOf"
import { getInternalSnapshot, reportInternalSnapshotObserved } from "./snapshots"
import { isTweakedObject, tweak } from "./tweaker"
import { isObject } from "./utils"

export function getSnapshot<T>(
  value: T,
  options?: {
    pureJson?: boolean
  }
): SnapshotOf<T> {
  if (!isObject(value)) {
    return value as any
  }

  // make sure the value is a tweaked value first
  if (!isTweakedObject(value)) {
    value = tweak(value, undefined)
  }
  const snapshot = getInternalSnapshot(value as any)
  if (!snapshot) {
    throw fail("getSnapshot is not supported for this kind of object")
  }

  reportInternalSnapshotObserved(snapshot)
  return (options && options.pureJson ? snapshot.pureJson : snapshot.standard) as any
}
