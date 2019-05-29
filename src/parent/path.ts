import { assertTweakedObject } from "../tweaker/core"
import { objectParents, reportParentPathObserved } from "./core"

export interface ParentPath<T extends object> {
  parent: T
  path: string
}

export interface RootPath<T extends object> {
  root: T
  path: string[]
}

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

export function getParent<T extends object = any>(value: object, reactive = true): T | undefined {
  assertTweakedObject(value, "getParent")

  const parentPath = getParentPath(value, reactive)
  return parentPath ? parentPath.parent : undefined
}

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

export function getRoot<T extends object = any>(value: object, reactive = true): T {
  assertTweakedObject(value, "getRoot")

  return getRootPath(value, reactive).root
}

export function isRoot(value: object, reactive = true): boolean {
  assertTweakedObject(value, "isRoot")

  return !getParent(value, reactive)
}

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

export function isParentOfChild(parent: object, child: object, reactive = true): boolean {
  assertTweakedObject(parent, "isParentOfChild")
  assertTweakedObject(child, "isParentOfChild")

  return isChildOfParent(child, parent, reactive)
}
