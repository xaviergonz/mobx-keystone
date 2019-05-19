import * as fsp from "fast-json-patch"
import { onSnapshot } from "../snapshot"
import { assertTweakedObject } from "../tweaker/core"
import { PatchOperation } from "./PatchOperation"

export function onPatches(
  obj: object,
  fn: (patches: PatchOperation[], inversePatches: PatchOperation[]) => void
): () => void {
  assertTweakedObject(obj, "onPatches")

  // TODO: use immer ops instead to generate patches?

  return onSnapshot(obj, (curSn: any, prevSn: any) => {
    const patches = fsp.compare(prevSn, curSn)
    if (patches.length > 0) {
      const inversePatches = fsp.compare(curSn, prevSn)
      fn(patches as any, inversePatches as any)
    }
  })
}
