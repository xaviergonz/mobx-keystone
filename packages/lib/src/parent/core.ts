import { createAtom, IAtom, observable, ObservableMap, ObservableSet } from "mobx"
import { AnyModel } from "../model/BaseModel"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { isRoot, ParentPath } from "./path"

/**
 * @ignore
 */
export const objectParents = new WeakMap<object, ParentPath<any> | undefined>()

/**
 * @ignore
 */
export const objectParentsAtoms = new WeakMap<object, IAtom>()

/**
 * @ignore
 */
export const objectChildren = new WeakMap<object, ObservableSet<any>>()

const rootIdCaches = new WeakMap<object, ObservableMap<string, AnyModel>>()

/**
 * @ignore
 */
export function getRootIdCache(root: object): ObservableMap<string, AnyModel> {
  let cache = rootIdCaches.get(root)
  if (!cache) {
    cache = observable.map()
    rootIdCaches.set(root, cache)
  }
  return cache
}

/**
 * Resolves a model inside a given subtree by its id.
 *
 * @typename M Model type.
 * @param treeRoot Root node object.
 * @param id Id to resolve.
 * @returns The resolved model or undefined if not found.
 */
export function resolveModelId<M extends AnyModel>(treeRoot: object, id: string): M | undefined {
  assertTweakedObject(treeRoot, "treeRoot")
  if (!isRoot(treeRoot)) {
    throw failure("a root node was expected")
  }

  let cache = rootIdCaches.get(treeRoot)
  if (!cache) {
    return undefined
  }
  const model = cache.get(id)
  return model as M | undefined
}

/**
 * @ignore
 */
export function parentPathEquals(
  parentPath1: ParentPath<any> | undefined,
  parentPath2: ParentPath<any> | undefined,
  comparePath = true
) {
  if (!parentPath1 && !parentPath2) return true
  if (!parentPath1 || !parentPath2) return false
  const parentEquals = parentPath1.parent === parentPath2.parent
  if (!parentEquals) return false
  return comparePath ? parentPath1.path === parentPath2.path : true
}

function createParentPathAtom(obj: object) {
  let atom = objectParentsAtoms.get(obj)
  if (!atom) {
    atom = createAtom("parentAtom")
    objectParentsAtoms.set(obj, atom)
  }
  return atom
}

/**
 * @ignore
 */
export function reportParentPathObserved(node: object) {
  createParentPathAtom(node).reportObserved()
}

/**
 * @ignore
 */
export function reportParentPathChanged(node: object) {
  createParentPathAtom(node).reportChanged()
}
