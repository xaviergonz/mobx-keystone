import { assertTweakedObject } from "../tweaker/core"
import { objectParents, reportParentPathObserved } from "./core"

/**
 * Path from an object to its immediate parent.
 *
 * @export
 * @interface ParentPath
 * @template T
 */
export interface ParentPath<T extends object> {
  /**
   * Parent object.
   */
  parent: T
  /**
   * Property name (if the parent is an object) or index number (if the parent is an array),
   * both in string format.
   */
  path: string
}

/**
 * Path from an object to its root.
 *
 * @export
 * @interface RootPath
 * @template T
 */
export interface RootPath<T extends object> {
  /**
   * Root object.
   */
  root: T
  /**
   * Path from the root to the given target, as a string array.
   * If the target is a root itself then the array will be empty.
   */
  path: string[]
}

/**
 * Returns the path to the parent of the target, or undefined if it has no parent.
 *
 * @export
 * @template T
 * @param value Target object.
 * @param [reactive=true] Use true (the default) to make this call reactive to changes, or false not to.
 * @returns
 */
export function getParentPath<T extends object = any>(
  value: object,
  reactive = true
): ParentPath<T> | undefined {
  assertTweakedObject(value, "getParentPath")

  if (reactive) {
    reportParentPathObserved(value)
  }
  return objectParents.get(value) as any
}

/**
 * Returns the parent object of the target object, or undefined if there's no parent.
 *
 * @export
 * @template T
 * @param value Target object.
 * @param [reactive=true] Use true (the default) to make this call reactive to changes, or false not to.
 * @returns
 */
export function getParent<T extends object = any>(value: object, reactive = true): T | undefined {
  assertTweakedObject(value, "getParent")

  const parentPath = getParentPath(value, reactive)
  return parentPath ? parentPath.parent : undefined
}

/**
 * Returns the path to the root of the target.
 *
 * @export
 * @template T
 * @param value Target object.
 * @param [reactive=true] Use true (the default) to make this call reactive to changes, or false not to.
 * @returns
 */
export function getRootPath<T extends object = any>(value: object, reactive = true): RootPath<T> {
  assertTweakedObject(value, "getRootPath")

  const rootPath: RootPath<any> = {
    root: value,
    path: [],
  }

  let parentPath
  while ((parentPath = getParentPath(rootPath.root, reactive))) {
    rootPath.root = parentPath.parent
    rootPath.path.unshift(parentPath.path)
  }

  return rootPath
}

/**
 * Returns the root of the target object, or itself if the target is a root.
 *
 * @export
 * @template T
 * @param value Target object.
 * @param [reactive=true] Use true (the default) to make this call reactive to changes, or false not to.
 * @returns
 */
export function getRoot<T extends object = any>(value: object, reactive = true): T {
  assertTweakedObject(value, "getRoot")

  return getRootPath(value, reactive).root
}

/**
 * Returns if a given object is a root object.
 *
 * @export
 * @param value Target object.
 * @param [reactive=true] Use true (the default) to make this call reactive to changes, or false not to.
 * @returns
 */
export function isRoot(value: object, reactive = true): boolean {
  assertTweakedObject(value, "isRoot")

  return !getParent(value, reactive)
}

/**
 * Returns if the target is a "child" of the tree of the given "parent" object.
 *
 * @export
 * @param child Target object.
 * @param parent Parent object.
 * @param [reactive=true] Use true (the default) to make this call reactive to changes, or false not to.
 * @returns
 */
export function isChildOfParent(child: object, parent: object, reactive = true): boolean {
  assertTweakedObject(child, "isChildOfParent")
  assertTweakedObject(parent, "isChildOfParent")

  let current = child
  let parentPath
  while ((parentPath = getParentPath(current, reactive))) {
    current = parentPath.parent
    if (current === parent) {
      return true
    }
  }
  return false
}

/**
 * Returns if the target is a "parent" that has in its tree the given "child" object.
 *
 * @export
 * @param parent Target object.
 * @param child Child object.
 * @param [reactive=true] Use true (the default) to make this call reactive to changes, or false not to.
 * @returns
 */
export function isParentOfChild(parent: object, child: object, reactive = true): boolean {
  assertTweakedObject(parent, "isParentOfChild")
  assertTweakedObject(child, "isParentOfChild")

  return isChildOfParent(child, parent, reactive)
}
