import { assertTweakedObject } from "../tweaker/core"
import { objectChildren } from "./core"

export function getChildrenObjects(target: object): Set<any> {
  assertTweakedObject(target, "getChildrenObjects")

  return objectChildren.get(target)!
}
