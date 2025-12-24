import { createAtom, IAtom } from "mobx"
import * as Y from "yjs"

const yjsCollectionAtoms = new WeakMap<Y.Map<unknown> | Y.Array<unknown>, IAtom>()

/**
 * @internal
 */
export const getYjsCollectionAtom = (
  yjsCollection: Y.Map<unknown> | Y.Array<unknown>
): IAtom | undefined => {
  return yjsCollectionAtoms.get(yjsCollection)
}

/**
 * @internal
 */
export const getOrCreateYjsCollectionAtom = (
  yjsCollection: Y.Map<unknown> | Y.Array<unknown>
): IAtom => {
  let atom = yjsCollectionAtoms.get(yjsCollection)
  if (!atom) {
    atom = createAtom(`yjsCollectionAtom`)
    yjsCollectionAtoms.set(yjsCollection, atom)
  }
  return atom
}
