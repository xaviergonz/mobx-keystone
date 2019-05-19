import { reaction } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { getSnapshot } from "./getSnapshot"
import { SnapshotOf } from "./SnapshotOf"

export function onSnapshot<T extends object>(
  obj: T,
  fn: (sn: SnapshotOf<T>, prevSn: SnapshotOf<T>) => void
): () => void {
  assertTweakedObject(obj, "onSnapshot")

  let currentSnapshot = getSnapshot(obj)
  return reaction(
    () => getSnapshot(obj),
    newSnapshot => {
      const prevSn = currentSnapshot
      currentSnapshot = newSnapshot
      fn(newSnapshot, prevSn)
    }
  )
}
