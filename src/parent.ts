import { isObservableArray, isObservableObject } from "mobx"
import { isTweakedObject } from "./tweaker"
import { isObject } from "./utils"

export interface ParentPath<T extends object> {
  parent: T
  path: string
}

export interface RootPath<T extends object> {
  root: T
  path: string[]
}

const objParents = new WeakMap<object, ParentPath<any> | undefined>()

export function getParentPath<T extends object = any>(value: object): ParentPath<T> | undefined {
  return objParents.get(value) as any
}

export function getParent<T extends object = any>(value: object): T | undefined {
  const parentPath = getParentPath(value)
  return parentPath ? parentPath.parent : undefined
}

export function getRootPath<T extends object = any>(value: object): RootPath<T> {
  const rootPath: RootPath<any> = {
    root: value,
    path: [],
  }

  let parentPath
  while ((parentPath = getParentPath(rootPath.root))) {
    rootPath.root = parentPath.parent
    rootPath.path.unshift(parentPath.path)
  }

  return rootPath
}

export function getRoot<T extends object = any>(value: object): T {
  return getRootPath(value).root
}

export type SetParentResult =
  | {
      oldParentPath: ParentPath<any> | undefined
      newParentPath: ParentPath<any> | undefined
      changed: boolean
    }
  | "primitive"

export function setParent(value: any, parentPath: ParentPath<any> | undefined): SetParentResult {
  if (!isObject(value)) {
    return "primitive"
  }

  if (process.env.NODE_ENV !== "production") {
    if (!isTweakedObject(value)) {
      throw fail(`assertion failed: value is not ready to take a parent`)
    }
    if (parentPath) {
      if (!isTweakedObject(parentPath.parent)) {
        throw fail(`assertion failed: parent is not ready to take children`)
      }
    }
  }

  const oldParentPath = getParentPath(value)
  if (parentPathEquals(oldParentPath, parentPath)) {
    return {
      newParentPath: parentPath,
      oldParentPath,
      changed: false,
    }
  }

  if (oldParentPath && parentPath) {
    throw fail("an object cannot be assigned a new parent when it already has one")
  }

  objParents.set(value, parentPath)
  return {
    newParentPath: parentPath,
    oldParentPath,
    changed: true,
  }
}

export function detach(value: object) {
  if (!isObject(value)) {
    throw fail("only objects can be detached")
  }

  const parentPath = getParentPath(value)
  if (!parentPath) return

  const { parent, path } = parentPath
  if (isObservableArray(parent)) {
    parent.splice(+path, 1)
  } else if (isObservableObject(parent)) {
    ;(parent as any)[path] = undefined
  } else {
    throw fail("parent must be an observable object or an observable array")
  }
}

function parentPathEquals(p1: ParentPath<any> | undefined, p2: ParentPath<any> | undefined) {
  if (!p1 && !p2) return true
  if (!p1 || !p2) return false
  return p1.parent === p2.parent && p1.path === p2.path
}

export function isChildOfParent(child: object, parent: object): boolean {
  if (typeof parent !== "object") {
    throw fail("parent must be an object")
  }
  if (typeof child !== "object") {
    throw fail("child must be an object")
  }

  let current = child
  let parentPath
  while ((parentPath = getParentPath(current))) {
    current = parentPath.parent
    if (current === parent) {
      return true
    }
  }
  return false
}

export function isParentOfChild(parent: object, child: object): boolean {
  return isChildOfParent(child, parent)
}
