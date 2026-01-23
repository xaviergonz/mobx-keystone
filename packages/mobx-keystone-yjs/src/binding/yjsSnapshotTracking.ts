import * as Y from "yjs"

/**
 * WeakMap that tracks which snapshot each Y.js container was last synced from.
 * This is used during reconciliation to skip containers that are already up-to-date.
 *
 * The key is the Y.js container (Y.Map or Y.Array).
 * The value is the snapshot (plain object or array) that was last synced to it.
 */
export const yjsContainerToSnapshot = new WeakMap<Y.Map<any> | Y.Array<any>, unknown>()

/**
 * Updates the snapshot tracking for a Y.js container.
 * Call this after syncing a snapshot to a Y.js container.
 */
export function setYjsContainerSnapshot(
  container: Y.Map<any> | Y.Array<any>,
  snapshot: unknown
): void {
  yjsContainerToSnapshot.set(container, snapshot)
}

/**
 * Gets the last synced snapshot for a Y.js container.
 * Returns undefined if the container has never been synced.
 */
export function getYjsContainerSnapshot(container: Y.Map<any> | Y.Array<any>): unknown {
  return yjsContainerToSnapshot.get(container)
}

/**
 * Checks if a Y.js container is up-to-date with the given snapshot.
 * Uses reference equality to check if the snapshot is the same.
 */
export function isYjsContainerUpToDate(
  container: Y.Map<any> | Y.Array<any>,
  snapshot: unknown
): boolean {
  return yjsContainerToSnapshot.get(container) === snapshot
}
