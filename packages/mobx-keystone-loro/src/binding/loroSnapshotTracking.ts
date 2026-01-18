import type { LoroMap, LoroMovableList } from "loro-crdt"

type LoroContainer = LoroMap | LoroMovableList

/**
 * WeakMap that tracks which snapshot each Loro container was last synced from.
 * This is used during reconciliation to skip containers that are already up-to-date.
 *
 * The key is the Loro container (LoroMap or LoroMovableList).
 * The value is the snapshot (plain object or array) that was last synced to it.
 */
export const loroContainerToSnapshot = new WeakMap<LoroContainer, unknown>()

/**
 * Updates the snapshot tracking for a Loro container.
 * Call this after syncing a snapshot to a Loro container.
 */
export function setLoroContainerSnapshot(container: LoroContainer, snapshot: unknown): void {
  loroContainerToSnapshot.set(container, snapshot)
}

/**
 * Gets the last synced snapshot for a Loro container.
 * Returns undefined if the container has never been synced.
 */
export function getLoroContainerSnapshot(container: LoroContainer): unknown {
  return loroContainerToSnapshot.get(container)
}

/**
 * Checks if a Loro container is up-to-date with the given snapshot.
 * Uses reference equality to check if the snapshot is the same.
 */
export function isLoroContainerUpToDate(container: LoroContainer, snapshot: unknown): boolean {
  return loroContainerToSnapshot.get(container) === snapshot
}
