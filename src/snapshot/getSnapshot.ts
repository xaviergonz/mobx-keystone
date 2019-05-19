import { assertTweakedObject } from "../tweaker/core"
import { getInternalSnapshot, reportInternalSnapshotObserved } from "./internal"
import { SnapshotOf } from "./SnapshotOf"
import { isObject, failure } from "../utils"

export function getSnapshot<T>(
  value: T,
  options?: {
    pureJson?: boolean
  }
): SnapshotOf<T> {
  if (!isObject(value)) {
    return value as any
  }

  assertTweakedObject(value, "getSnapshot")

  const snapshot = getInternalSnapshot(value as any)
  if (!snapshot) {
    throw failure("getSnapshot is not supported for this kind of object")
  }

  reportInternalSnapshotObserved(snapshot)
  return (options && options.pureJson ? snapshot.pureJson : snapshot.standard) as any
}
