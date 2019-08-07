import { assertTweakedObject } from "../tweaker/core"
import { isObject } from "../utils"
import { objectParents, reportParentPathObserved } from "./core"

/**
 * Path from an object to its immediate parent.
 *
 * @typeparam T Parent object type.
 */
export interface ParentPath<T extends object> {
  /**
   * Parent object.
   */
  readonly parent: T
  /**
   * Property name (if the parent is an object) or index number (if the parent is an array).
   */
  readonly path: string | number
}

/**
 * Path from an object to its root.
 *
 * @typeparam T Root object type.
 */
export interface RootPath<T extends object> {
  /**
   * Root object.
   */
  readonly root: T
  /**
   * Path from the root to the given target, as a string array.
   * If the target is a root itself then the array will be empty.
   */
  readonly path: ReadonlyArray<string | number>
}

/**
 * Returns the parent of the target plus the path from the parent to the target, or undefined if it has no parent.
 *
 * @typeparam T Parent object type.
 * @param node Target object.
 * @returns
 */
export function getParentPath<T extends object = any>(node: object): ParentPath<T> | undefined {
  assertTweakedObject(node, "node")

  reportParentPathObserved(node)
  return objectParents.get(node) as any
}

/**
 * Returns the parent object of the target object, or undefined if there's no parent.
 *
 * @typeparam T Parent object type.
 * @param node Target object.
 * @returns
 */
export function getParent<T extends object = any>(node: object): T | undefined {
  assertTweakedObject(node, "node")

  const parentPath = getParentPath(node)
  return parentPath ? parentPath.parent : undefined
}

/**
 * Returns the root of the target plus the path from the root to get to the target.
 *
 * @typeparam T Root object type.
 * @param node Target object.
 * @returns
 */
export function getRootPath<T extends object = any>(node: object): RootPath<T> {
  assertTweakedObject(node, "node")

  const rootPath = {
    root: node,
    path: [] as (string | number)[],
  }

  let parentPath
  while ((parentPath = getParentPath(rootPath.root))) {
    rootPath.root = parentPath.parent
    rootPath.path.unshift(parentPath.path)
  }

  return rootPath as RootPath<any>
}

/**
 * Returns the root of the target object, or itself if the target is a root.
 *
 * @typeparam T Root object type.
 * @param node Target object.
 * @returns
 */
export function getRoot<T extends object = any>(node: object): T {
  assertTweakedObject(node, "node")

  return getRootPath(node).root
}

/**
 * Returns if a given object is a root object.
 *
 * @param node Target object.
 * @returns
 */
export function isRoot(node: object): boolean {
  assertTweakedObject(node, "node")

  return !getParent(node)
}

/**
 * Returns if the target is a "child" of the tree of the given "parent" object.
 *
 * @param node Target object.
 * @param parentNode Parent object.
 * @returns
 */
export function isChildOfParent(node: object, parentNode: object): boolean {
  assertTweakedObject(node, "node")
  assertTweakedObject(parentNode, "parentNode")

  let current = node
  let parentPath
  while ((parentPath = getParentPath(current))) {
    current = parentPath.parent
    if (current === parentNode) {
      return true
    }
  }
  return false
}

/**
 * Returns if the target is a "parent" that has in its tree the given "child" object.
 *
 * @param node Target object.
 * @param childNode Child object.
 * @returns
 */
export function isParentOfChild(node: object, childNode: object): boolean {
  assertTweakedObject(node, "node")
  assertTweakedObject(childNode, "childNode")

  return isChildOfParent(childNode, node)
}

/**
 * Tries to resolve a path from an object.
 *
 * @typeparam T Returned value type.
 * @param pathRootNode Object that serves as path root.
 * @param path Path as an string or number array.
 * @returns An object with `{ resolved: true, value: T }` or `{ resolved: false }`.
 */
export function resolvePath<T = any>(
  pathRootNode: object,
  path: ReadonlyArray<string | number>
):
  | {
      resolved: true
      value: T
    }
  | {
      resolved: false
      value?: undefined
    } {
  let current: any = pathRootNode

  let len = path.length
  for (let i = 0; i < len; i++) {
    if (!isObject(current)) {
      return { resolved: false }
    }

    current = current[path[i]]
  }

  return { resolved: true, value: current }
}
