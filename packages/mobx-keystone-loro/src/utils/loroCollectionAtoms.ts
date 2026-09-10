import { CrdtCollectionAtoms } from "@mobx-keystone/crdt-binding-common"
import type { ContainerID, LoroEvent, LoroMap, LoroMovableList } from "loro-crdt"
import type { BindableLoroContainer } from "./isBindableLoroContainer"

// Loro can return different JS wrappers for the same container. Scope atoms by
// binding root and native ID, rather than by those temporary wrapper objects.
const loroCollectionAtoms = new CrdtCollectionAtoms<BindableLoroContainer, ContainerID>()

/** @internal */
export function getLoroCollectionAtom(root: BindableLoroContainer, id: ContainerID, key?: string) {
  return loroCollectionAtoms.get(root, id, key)
}

/** @internal */
export function reportLoroCollectionObserved(
  root: BindableLoroContainer,
  container: LoroMap | LoroMovableList,
  key?: string
): void {
  loroCollectionAtoms.reportObserved(root, () => container.id, key)
}

/** @internal */
export function reportLoroEventsChanged(
  root: BindableLoroContainer,
  events: readonly LoroEvent[]
): void {
  for (const event of events) {
    const diff = event.diff
    if (diff.type === "map") {
      for (const key of Object.keys(diff.updated)) {
        loroCollectionAtoms.reportChanged(root, event.target, key)
      }
    } else if (
      diff.type === "list" &&
      diff.diff.some((part) => part.delete || part.insert?.length)
    ) {
      loroCollectionAtoms.reportChanged(root, event.target)
    }
  }
}
