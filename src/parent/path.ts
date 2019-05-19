import { objectParents } from "./core"
import { assertTweakedObject } from "../tweaker/core"

export interface ParentPath<T extends object> {
  parent: T
  path: string
}

export interface RootPath<T extends object> {
  root: T
  path: string[]
}

export function getParentPath<T extends object = any>(value: object): ParentPath<T> | undefined {
  assertTweakedObject(value, "getParentPath")

  return objectParents.get(value) as any
}

export function getParent<T extends object = any>(value: object): T | undefined {
  assertTweakedObject(value, "getParent")

  const parentPath = getParentPath(value)
  return parentPath ? parentPath.parent : undefined
}

export function getRootPath<T extends object = any>(value: object): RootPath<T> {
  assertTweakedObject(value, "getRootPath")

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
  assertTweakedObject(value, "getRoot")

  return getRootPath(value).root
}

export function isChildOfParent(child: object, parent: object): boolean {
  assertTweakedObject(child, "isChildOfParent")
  assertTweakedObject(parent, "isChildOfParent")

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
  assertTweakedObject(parent, "isParentOfChild")
  assertTweakedObject(child, "isParentOfChild")

  return isChildOfParent(child, parent)
}
