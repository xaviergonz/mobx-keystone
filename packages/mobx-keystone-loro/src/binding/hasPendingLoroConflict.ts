import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { getSnapshotModelTypeAndId, isFrozenSnapshot, modelTypeKey } from "mobx-keystone"
import { isBindableLoroContainer } from "../utils/isBindableLoroContainer"
import { loroTextModelId } from "./LoroTextModel"

/**
 * Remembers the containers already compared while the native state is unchanged,
 * so many changes to one list do not rescan it.
 * @internal
 */
export type PendingLoroConflictCache = WeakMap<object, boolean>

/**
 * Whether the native value still holds the kind and identity the snapshot
 * recorded. List entries are compared too, but only by kind and identity: a
 * deeper difference is reached through the edited path itself.
 */
function conflictsWithSnapshot(
  container: unknown,
  snapshot: unknown,
  cache: PendingLoroConflictCache,
  scanList: boolean
): boolean {
  const model = getSnapshotModelTypeAndId(snapshot)
  if (model) {
    if (model.modelType === loroTextModelId) return !(container instanceof LoroText)
    return (
      !(container instanceof LoroMap) ||
      container.get(modelTypeKey) !== model.modelType ||
      (model.modelIdPropertyName !== undefined &&
        container.get(model.modelIdPropertyName) !== model.modelId)
    )
  }
  // Loro stores primitives and frozen values as plain values, so a container
  // here means a pending native write replaced what the snapshot recorded.
  if (isFrozenSnapshot(snapshot) || snapshot === null || typeof snapshot !== "object") {
    return isBindableLoroContainer(container)
  }
  if (!Array.isArray(snapshot)) return !(container instanceof LoroMap)

  // Index-based writes assume the list still holds what the snapshot saw, so a
  // pending native resize, reorder or replacement invalidates them.
  if (!(container instanceof LoroMovableList) || container.length !== snapshot.length) return true
  if (!scanList) return false
  const cached = cache.get(snapshot)
  if (cached !== undefined) return cached
  const conflict = container
    .toArray()
    .some((item, index) => conflictsWithSnapshot(item, snapshot[index], cache, false))
  cache.set(snapshot, conflict)
  return conflict
}

/**
 * Check only edited paths before combining local writes with pending native data.
 * An incremental write is unsafe once the native value it targets no longer
 * matches what the local snapshot saw.
 * @internal
 */
export function hasPendingLoroConflict(
  container: unknown,
  snapshot: unknown,
  path: readonly (string | number)[],
  cache: PendingLoroConflictCache = new WeakMap()
): boolean {
  for (let depth = 0; ; depth++) {
    if (conflictsWithSnapshot(container, snapshot, cache, true)) return true
    if (depth === path.length || snapshot === null || typeof snapshot !== "object") return false
    const key = path[depth]
    snapshot = (snapshot as Record<string | number, unknown>)[key]
    container =
      container instanceof LoroMap
        ? container.get(String(key))
        : container instanceof LoroMovableList &&
            typeof key === "number" &&
            key >= 0 &&
            key < container.length
          ? container.get(key)
          : undefined
  }
}
