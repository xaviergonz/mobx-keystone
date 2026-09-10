import { CrdtCollectionAtoms } from "@mobx-keystone/crdt-binding-common"
import type * as Y from "yjs"

type YjsCollection = Y.Map<unknown> | Y.Array<unknown>

// Yjs hands out stable objects per container, so each collection is its own scope.
const singleContainer = undefined
const yjsCollectionAtoms = new CrdtCollectionAtoms<YjsCollection, undefined>()

/** @internal */
export const getYjsCollectionAtom = (collection: YjsCollection, key?: string) =>
  yjsCollectionAtoms.get(collection, singleContainer, key)

/** @internal */
export const reportYjsCollectionObserved = (collection: YjsCollection, key?: string): void => {
  yjsCollectionAtoms.reportObserved(collection, () => singleContainer, key)
}
