import { ParentPath } from "./core"

const objParents = new WeakMap<object, ParentPath<any> | undefined>()

export function getObjectParents() {
  return objParents
}

export function parentPathEquals(p1: ParentPath<any> | undefined, p2: ParentPath<any> | undefined) {
  if (!p1 && !p2) return true
  if (!p1 || !p2) return false
  return p1.parent === p2.parent && p1.path === p2.path
}
