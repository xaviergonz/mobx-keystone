import { assertTweakedObject } from "../tweaker/core"
import { getParentPath } from "./path"

export function findParent<T extends object = any>(
  child: object,
  predicate: (parent: any) => boolean
): T | undefined {
  assertTweakedObject(child, "findParent")

  let current: any = child
  let parentPath
  while ((parentPath = getParentPath(current))) {
    current = parentPath.parent
    if (predicate(current)) {
      return current
    }
  }
  return undefined
}
