import { createAtom, IAtom } from "mobx"
import { isModel } from "../model/utils"
import { getOrCreate } from "../utils/mapUtils"
import type { ParentPath } from "./path"

/**
 * @internal
 */
export const objectParents = new WeakMap<object, ParentPath<object> | undefined>()

const objectParentsAtoms = new WeakMap<object, IAtom>()

/**
 * @internal
 */
export function parentPathEquals(
  parentPath1: ParentPath<any> | undefined,
  parentPath2: ParentPath<any> | undefined
) {
  if (!parentPath1 && !parentPath2) return true
  if (!parentPath1 || !parentPath2) return false
  return parentPath1.parent === parentPath2.parent && parentPath1.path === parentPath2.path
}

function createParentPathAtom(obj: object) {
  return getOrCreate(objectParentsAtoms, obj, () => createAtom("parentAtom"))
}

/**
 * @internal
 */
export function reportParentPathObserved(node: object) {
  createParentPathAtom(node).reportObserved()
}

/**
 * @internal
 */
export function reportParentPathChanged(node: object) {
  createParentPathAtom(node).reportChanged()
}

/**
 * @internal
 */
export const dataObjectParent = new WeakMap<object, object>()

/**
 * @internal
 */
export function dataToModelNode<T extends object>(node: T): T {
  const modelNode = dataObjectParent.get(node)
  return (modelNode as T) ?? node
}

/**
 * @internal
 */
export function modelToDataNode<T extends object>(node: T): T {
  return isModel(node) ? node.$ : node
}
