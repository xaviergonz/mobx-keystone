import { assertTweakedObject } from "../tweaker/core"
import { getChildrenObjects } from "./getChildrenObjects"

export enum WalkTreeMode {
  ParentFirst = "parentFirst",
  ChildrenFirst = "childrenFirst",
}

export function walkTree<T = void>(
  target: object,
  predicate: (node: any) => T | undefined,
  mode: WalkTreeMode
): T | undefined {
  assertTweakedObject(target, "walkTree")

  if (mode === WalkTreeMode.ParentFirst) {
    const ret = predicate(target)
    if (ret !== undefined) {
      return ret
    }
  }

  const children = getChildrenObjects(target)
  for (const ch of children) {
    const ret = walkTree(ch, predicate, mode)
    if (ret !== undefined) {
      return ret
    }
  }

  if (mode === WalkTreeMode.ChildrenFirst) {
    const ret = predicate(target)
    if (ret !== undefined) {
      return ret
    }
  }

  return undefined
}
