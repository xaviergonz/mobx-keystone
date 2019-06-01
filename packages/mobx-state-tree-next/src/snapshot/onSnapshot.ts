import { reaction } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { getSnapshot } from "./getSnapshot"
import { SnapshotOutOf } from "./SnapshotOf"

export function onSnapshot<T extends object>(
  obj: T,
  fn: (sn: SnapshotOutOf<T>, prevSn: SnapshotOutOf<T>) => void
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
