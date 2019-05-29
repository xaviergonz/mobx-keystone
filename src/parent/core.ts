import { createAtom, IAtom, observable, ObservableMap, ObservableSet } from "mobx"
import { Model } from "../model/Model"
import { ParentPath } from "./path"

export const objectParents = new WeakMap<object, ParentPath<any> | undefined>()
export const objectParentsAtoms = new WeakMap<object, IAtom>()

export const objectChildren = new WeakMap<object, ObservableSet<any>>()

const rootIdCaches = new WeakMap<object, ObservableMap<string, Model>>()
export function getRootIdCache(root: object): ObservableMap<string, Model> {
  let cache = rootIdCaches.get(root)
  if (!cache) {
    cache = observable.map()
    rootIdCaches.set(root, cache)
  }
  return cache
}

export function parentPathEquals(
  p1: ParentPath<any> | undefined,
  p2: ParentPath<any> | undefined,
  comparePath = true
) {
  if (!p1 && !p2) return true
  if (!p1 || !p2) return false
  const parentEquals = p1.parent === p2.parent
  if (!parentEquals) return false
  return comparePath ? p1.path === p2.path : true
}

function createParentPathAtom(obj: object) {
  let atom = objectParentsAtoms.get(obj)
  if (!atom) {
    atom = createAtom("parentAtom")
    objectParentsAtoms.set(obj, atom)
  }
  return atom
}

export function reportParentPathObserved(obj: object) {
  createParentPathAtom(obj).reportObserved()
}

export function reportParentPathChanged(obj: object) {
  createParentPathAtom(obj).reportChanged()
}
