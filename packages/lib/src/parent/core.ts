import { createAtom, IAtom } from "mobx"
import { isModel } from "../model/utils"
import { ParentPath } from "./path"

/**
 * @ignore
 */
export const objectParents = new WeakMap<object, ParentPath<object> | undefined>()

/**
 * @ignore
 */
export const objectParentsAtoms = new WeakMap<object, IAtom>()

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

/**
 * @ignore
 */
export const dataObjectParent = new WeakMap<object, object>()

/**
 * @ignore
 */
export function dataToModelNode<T extends object>(node: T): T {
  const modelNode = dataObjectParent.get(node)
  return (modelNode as T) || node
}

/**
 * @ignore
 */
export function modelToDataNode<T extends object>(node: T): T {
  return isModel(node) ? node.$ : node
}
