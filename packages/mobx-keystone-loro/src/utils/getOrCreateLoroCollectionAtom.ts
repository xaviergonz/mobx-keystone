import { createAtom, type IAtom } from "mobx"
import type { BindableLoroContainer } from "./isBindableLoroContainer"

const atomMap = new WeakMap<BindableLoroContainer, IAtom>()

/**
 * Gets or creates a MobX atom for a Loro collection.
 * This is used to track reactivity for computed properties that read from Loro containers.
 */
export function getOrCreateLoroCollectionAtom(collection: BindableLoroContainer): IAtom {
  let atom = atomMap.get(collection)
  if (!atom) {
    atom = createAtom(`loroCollectionAtom`)
    atomMap.set(collection, atom)
  }
  return atom
}
