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
 * @template T Object type.
 * @param nodeOrFn Object to get the snapshot from or a function to get it.
 * @param listener Function that will be triggered when the snapshot changes.
 * @returns A disposer.
 */
export function onSnapshot<T extends object>(
  nodeOrFn: T | (() => T),
  listener: OnSnapshotListener<T>
): OnSnapshotDisposer {
  const nodeFn = typeof nodeOrFn === "function" ? (nodeOrFn as () => T) : () => nodeOrFn

  const node = nodeFn()
  assertTweakedObject(node, "node")

  let currentSnapshot = getSnapshot(node)
  let firstTrackingRun = true

  return reaction(
    () => {
      const snapshot = getSnapshot(nodeFn())
      // Registration inside an action defers the first tracking run until the
      // action ends. Its snapshot, rather than the earlier registration state,
      // is the baseline for the first notification.
      if (firstTrackingRun) {
        firstTrackingRun = false
        currentSnapshot = snapshot
      }
      return snapshot
    },
    (newSnapshot) => {
      const prevSn = currentSnapshot
      currentSnapshot = newSnapshot
      listener(newSnapshot, prevSn)
    }
  )
}
