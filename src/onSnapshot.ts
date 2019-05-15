import { SnapshotOf } from "./SnapshotOf"
import { getSnapshot } from "./getSnapshot"
import { reaction } from "mobx"

export function onSnapshot<T extends object>(
  obj: T,
  fn: (sn: SnapshotOf<T>, prevSn: SnapshotOf<T>) => void
): () => void {
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
