import { getObjectParents } from "./_internal"

export interface ParentPath<T extends object> {
  parent: T
  path: string
}

export interface RootPath<T extends object> {
  root: T
  path: string[]
}

export function getParentPath<T extends object = any>(value: object): ParentPath<T> | undefined {
  return getObjectParents().get(value) as any
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
