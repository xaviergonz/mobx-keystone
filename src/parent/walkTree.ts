import { assertTweakedObject } from "../tweaker/core"
import { getChildrenObjects } from "./getChildrenObjects"

export function walkTree(
  target: object,
  predicate: (node: any) => void,
  mode: "parentFirst" | "childrenFirst"
): void {
  assertTweakedObject(target, "walkTree")

  if (mode === "parentFirst") {
    predicate(target)
  }
  getChildrenObjects(target).forEach(ch => walkTree(ch, predicate, mode))
  if (mode === "childrenFirst") {
    predicate(target)
  }
}
