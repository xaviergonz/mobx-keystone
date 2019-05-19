import { ParentPath } from "./path"

export const objectParents = new WeakMap<object, ParentPath<any> | undefined>()
export const objectChildren = new WeakMap<object, Set<any>>()

export function parentPathEquals(
  p1: ParentPath<any> | undefined,
  p2: ParentPath<any> | undefined,
  comparePath = true
) {
  if (!p1 && !p2) return true
  if (!p1 || !p2) return false
  const parentEquals = p1.parent === p2.parent
  if (!parentEquals) return false
  return comparePath ? p1.path === p2.path : true
}
