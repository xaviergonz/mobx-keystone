import { BaseModel } from "../model/BaseModel"
import { assertTweakedObject } from "../tweaker/core"
import { isObject } from "../utils"
import { objectParents, reportParentPathObserved } from "./core"
import { getDeepObjectChildren } from "./coreObjectChildren"

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
 * @param value Target object.
 * @returns
 */
export function getParentPath<T extends object = any>(value: object): ParentPath<T> | undefined {
  assertTweakedObject(value, "value")

  return fastGetParentPath(value)
}

/**
 * @ignore
 */
export function fastGetParentPath<T extends object = any>(
  value: object
): ParentPath<T> | undefined {
  reportParentPathObserved(value)
  return objectParents.get(value) as any
}

/**
 * Returns the parent object of the target object, or undefined if there's no parent.
 *
 * @typeparam T Parent object type.
 * @param value Target object.
 * @param [skipModelDataObject] When set to `true` (default is `false`) it will skip the interim model data object (`$`)
 * and return the model instance directly.
 * @returns
 */
export function getParent<T extends object = any>(
  value: object,
  skipModelDataObject = false
): T | undefined {
  assertTweakedObject(value, "value")

  return fastGetParent(value, skipModelDataObject)
}

/**
 * @ignore
 */
export function fastGetParent<T extends object = any>(
  value: object,
  skipModelDataObject = false
): T | undefined {
  const parentPath = fastGetParentPath(value)

  if (parentPath && skipModelDataObject && fastIsModelDataObject(parentPath.parent)) {
    return fastGetParent(parentPath.parent, false)
  } else {
    return parentPath ? parentPath.parent : undefined
  }
}

/**
 * Returns if a given object is a model interim data object (`$`).
 *
 * @param value Object to check.
 * @returns true if it is, false otherwise.
 */
export function isModelDataObject(value: object): boolean {
  assertTweakedObject(value, "value")

  return fastIsModelDataObject(value)
}

/**
 * @ignore
 */
export function fastIsModelDataObject(value: object): boolean {
  if (!isObject(value)) {
    return false
  }
  const parentPath = fastGetParentPath(value)
  return !!parentPath && parentPath.path === "$" && parentPath.parent instanceof BaseModel
}

/**
 * Returns the root of the target plus the path from the root to get to the target.
 *
 * @typeparam T Root object type.
 * @param value Target object.
 * @returns
 */
export function getRootPath<T extends object = any>(value: object): RootPath<T> {
  assertTweakedObject(value, "value")

  return fastGetRootPath(value)
}

/**
 * @ignore
 */
export function fastGetRootPath<T extends object = any>(value: object): RootPath<T> {
  const rootPath = {
    root: value,
    path: [] as (string | number)[],
  }

  let parentPath: ParentPath<any> | undefined
  while ((parentPath = fastGetParentPath(rootPath.root))) {
    rootPath.root = parentPath.parent
    rootPath.path.unshift(parentPath.path)
  }

  return rootPath as RootPath<any>
}

/**
 * Returns the root of the target object, or itself if the target is a root.
 *
 * @typeparam T Root object type.
 * @param value Target object.
 * @returns
 */
export function getRoot<T extends object = any>(value: object): T {
  assertTweakedObject(value, "value")

  return fastGetRoot(value)
}

/**
 * @ignore
 */
export function fastGetRoot<T extends object = any>(value: object): T {
  return fastGetRootPath(value).root
}

/**
 * Returns if a given object is a root object.
 *
 * @param value Target object.
 * @returns
 */
export function isRoot(value: object): boolean {
  assertTweakedObject(value, "value")

  return !fastGetParent(value)
}

/**
 * Returns if the target is a "child" of the tree of the given "parent" object.
 *
 * @param child Target object.
 * @param parent Parent object.
 * @returns
 */
export function isChildOfParent(child: object, parent: object): boolean {
  assertTweakedObject(child, "child")
  assertTweakedObject(parent, "parent")

  // since deep children does not include "$" we will check the parent
  if (fastIsModelDataObject(child)) {
    child = fastGetParent(child)!
    // edge case, where we are checking if $ is child of model directly
    if (child === parent) {
      return true
    }
  }
  if (fastIsModelDataObject(parent)) {
    parent = fastGetParent(parent)!
  }

  return getDeepObjectChildren(parent).has(child)
}

/**
 * Returns if the target is a "parent" that has in its tree the given "child" object.
 *
 * @param parent Target object.
 * @param child Child object.
 * @returns
 */
export function isParentOfChild(parent: object, child: object): boolean {
  assertTweakedObject(parent, "parent")
  assertTweakedObject(child, "child")

  return isChildOfParent(child, parent)
}

/**
 * Tries to resolve a path from an object.
 *
 * @typeparam T Returned value type.
 * @param pathRootObject Object that serves as path root.
 * @param path Path as an string or number array.
 * @returns An object with `{ resolved: true, value: T }` or `{ resolved: false }`.
 */
export function resolvePath<T = any>(
  pathRootObject: object,
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
  let current: any = pathRootObject

  let len = path.length
  for (let i = 0; i < len; i++) {
    if (!isObject(current)) {
      return { resolved: false }
    }

    current = current[path[i]]
  }

  return { resolved: true, value: current }
}

/**
 * Gets the path to get from a parent to a given child.
 * Returns an empty array if the child is actually the given parent or undefined if the child is not a child of the parent.
 *
 * @param fromParent
 * @param toChild
 * @returns
 */
export function getParentToChildPath(
  fromParent: object,
  toChild: object
): (string | number)[] | undefined {
  assertTweakedObject(fromParent, "fromParent")
  assertTweakedObject(toChild, "toChild")

  if (fromParent === toChild) {
    return []
  }

  const path: (string | number)[] = []

  let current = toChild
  let parentPath
  while ((parentPath = fastGetParentPath(current))) {
    path.unshift(parentPath.path)

    current = parentPath.parent
    if (current === fromParent) {
      return path
    }
  }
  return undefined
}
