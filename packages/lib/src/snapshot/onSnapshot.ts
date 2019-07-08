import { reaction } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { getSnapshot } from "./getSnapshot"
import { SnapshotOutOf } from "./SnapshotOf"

/**
 * Listener function for onSnapshot.
 */
export type OnSnapshotListener<T> = (sn: SnapshotOutOf<T>, prevSn: SnapshotOutOf<T>) => void

/**
 * Disposer function for onSnapshot.
 */
export type OnSnapshotDisposer = () => void

/**
 * Adds a reaction that will trigger every time an snapshot changes.
 *
 * @typeparam T Object type.
 * @param obj Object to get the snapshot from.
 * @param listener Function that will be triggered when the snapshot changes.
 * @returns A disposer.
 */
export function onSnapshot<T extends object>(
  obj: T,
  listener: OnSnapshotListener<T>
): OnSnapshotDisposer {
  assertTweakedObject(obj, "onSnapshot")

  let currentSnapshot = getSnapshot(obj)
  return reaction(
    () => getSnapshot(obj),
    newSnapshot => {
      const prevSn = currentSnapshot
      currentSnapshot = newSnapshot
      listener(newSnapshot, prevSn)
    }
  )
}
