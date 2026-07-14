import { createAtom, type IAtom } from "mobx"
import { isModel } from "../model/utils"
import { treeNodeMetadata } from "../tweaker/treeNodeMetadata"
import { getOrCreate } from "../utils/mapUtils"
import type { ParentPath } from "./path"

const objectParentsAtoms = new WeakMap<object, IAtom>()

/**
 * @internal
 */
export function parentPathEquals(
  parentPath1: ParentPath<any> | undefined,
  parentPath2: ParentPath<any> | undefined
) {
  if (!(parentPath1 || parentPath2)) {
    return true
  }
  if (!(parentPath1 && parentPath2)) {
    return false
  }
  return parentPath1.parent === parentPath2.parent && parentPath1.path === parentPath2.path
}

function createParentPathAtom() {
  return createAtom("parentAtom")
}

/**
 * @internal
 */
export function reportParentPathObserved(node: object) {
  getOrCreate(objectParentsAtoms, node, createParentPathAtom).reportObserved()
}

/**
 * @internal
 */
export function reportParentPathChanged(node: object) {
  objectParentsAtoms.get(node)?.reportChanged()
}

/** @internal */
export function getDataObjectParent(node: object): object | undefined {
  return treeNodeMetadata.get(node)?.dataObjectParent
}

/** @internal */
export function hasDataObjectParent(node: object): boolean {
  return treeNodeMetadata.get(node)?.dataObjectParent !== undefined
}

/** @internal */
export function setDataObjectParent(node: object, parent: object): void {
  treeNodeMetadata.get(node)!.dataObjectParent = parent
}

/**
 * @internal
 */
export function dataToModelNode<T extends object>(node: T): T {
  const modelNode = getDataObjectParent(node)
  return (modelNode as T | undefined) ?? node
}

/**
 * @internal
 */
export function modelToDataNode<T extends object>(node: T): T {
  return isModel(node) ? node.$ : node
}
