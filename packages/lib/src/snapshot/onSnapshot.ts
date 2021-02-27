import { reaction } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { getSnapshot } from "./getSnapshot"
import type { SnapshotOutOf } from "./SnapshotOf"

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
 * @param node Object to get the snapshot from.
 * @param listener Function that will be triggered when the snapshot changes.
 * @returns A disposer.
 */
export function onSnapshot<T extends object>(
  node: T,
  listener: OnSnapshotListener<T>
): OnSnapshotDisposer {
  assertTweakedObject(node, "node")

  let currentSnapshot = getSnapshot(node)
  return reaction(
    () => getSnapshot(node),
    (newSnapshot) => {
      const prevSn = currentSnapshot
      currentSnapshot = newSnapshot
      listener(newSnapshot, prevSn)
    }
  )
}
