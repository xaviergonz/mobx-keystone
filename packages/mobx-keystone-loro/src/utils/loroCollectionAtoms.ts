import type { ContainerID, LoroEvent, LoroMap, LoroMovableList } from "loro-crdt"
import { _isComputingDerivation, createAtom, type IAtom } from "mobx"
import type { BindableLoroContainer } from "./isBindableLoroContainer"

// Loro can return different JS wrappers for the same container. Scope atoms by
// binding root and native ID, rather than by those temporary wrapper objects.
const roots = new WeakMap<BindableLoroContainer, Map<ContainerID, Map<string | undefined, IAtom>>>()

/** @internal */
export function getLoroCollectionAtom(
  root: BindableLoroContainer,
  id: ContainerID,
  key?: string
): IAtom | undefined {
  return roots.get(root)?.get(id)?.get(key)
}

/** @internal */
export function reportLoroCollectionObserved(
  root: BindableLoroContainer,
  container: LoroMap | LoroMovableList,
  key?: string
): void {
  // Path resolution mostly runs while writing to Loro, outside any derivation.
  // `reportObserved` would be a no-op there, so skip reading the native
  // container id and allocating a throwaway atom.
  if (!_isComputingDerivation()) {
    return
  }
  const id = container.id
  let containers = roots.get(root)
  if (!containers) {
    containers = new Map()
    roots.set(root, containers)
  }
  const existing = containers.get(id)?.get(key)
  if (existing) {
    existing.reportObserved()
    return
  }
  const atom = createAtom("loroCollectionAtom", undefined, () => {
    const keys = containers.get(id)
    if (keys?.get(key) === atom) {
      keys.delete(key)
      if (keys.size === 0) containers.delete(id)
    }
  })
  if (atom.reportObserved()) {
    let keys = containers.get(id)
    if (!keys) {
      keys = new Map()
      containers.set(id, keys)
    }
    keys.set(key, atom)
  }
}

/** @internal */
export function reportLoroEventsChanged(
  root: BindableLoroContainer,
  events: readonly LoroEvent[]
): void {
  for (const event of events) {
    const diff = event.diff
    if (diff.type === "map") {
      for (const key of Object.keys(diff.updated))
        getLoroCollectionAtom(root, event.target, key)?.reportChanged()
    } else if (
      diff.type === "list" &&
      diff.diff.some((part) => part.delete || part.insert?.length)
    ) {
      getLoroCollectionAtom(root, event.target)?.reportChanged()
    }
  }
}
