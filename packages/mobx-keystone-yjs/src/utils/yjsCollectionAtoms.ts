import { _isComputingDerivation, createAtom, type IAtom } from "mobx"
import type * as Y from "yjs"

// Maps track individual keys; arrays track the whole collection because a
// splice can change the value at every subsequent index.
const yjsCollectionAtoms = new WeakMap<
  Y.Map<unknown> | Y.Array<unknown>,
  Map<string | undefined, IAtom>
>()

/** @internal */
export const getYjsCollectionAtom = (
  collection: Y.Map<unknown> | Y.Array<unknown>,
  key?: string
): IAtom | undefined => yjsCollectionAtoms.get(collection)?.get(key)

/** @internal */
export const reportYjsCollectionObserved = (
  collection: Y.Map<unknown> | Y.Array<unknown>,
  key?: string
): void => {
  // Path resolution mostly runs while writing to Yjs, outside any derivation.
  // `reportObserved` would be a no-op there, so skip allocating a throwaway atom.
  if (!_isComputingDerivation()) {
    return
  }
  let atoms = yjsCollectionAtoms.get(collection)
  if (!atoms) {
    atoms = new Map()
    yjsCollectionAtoms.set(collection, atoms)
  }
  const existing = atoms.get(key)
  if (existing) {
    existing.reportObserved()
    return
  }

  const atom = createAtom("yjsCollectionAtom", undefined, () => {
    if (atoms.get(key) === atom) {
      atoms.delete(key)
    }
  })
  if (atom.reportObserved()) {
    atoms.set(key, atom)
  }
}
