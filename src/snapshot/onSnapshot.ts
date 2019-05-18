import { SnapshotOf } from "./SnapshotOf"
import { getSnapshot } from "./getSnapshot"
import { reaction } from "mobx"
import { isObject } from "../utils"

export function onSnapshot<T extends object>(
  obj: T,
  fn: (sn: SnapshotOf<T>, prevSn: SnapshotOf<T>) => void
): () => void {
  if (!isObject(obj)) {
    throw fail("onSnapshot target must be an object")
  }

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
