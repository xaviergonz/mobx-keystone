import * as fsp from "fast-json-patch"
import { onSnapshot } from "../snapshot"
import { PatchOperation } from "./PatchOperation"
import { isObject } from "../utils"

export function onPatches(
  obj: object,
  fn: (patches: PatchOperation[], inversePatches: PatchOperation[]) => void
): () => void {
  if (!isObject(obj)) {
    throw fail("onPatches target must be an object")
  }

  // TODO: use immer ops instead to generate patches?

  return onSnapshot(obj, (curSn: any, prevSn: any) => {
    const patches = fsp.compare(prevSn, curSn)
    if (patches.length > 0) {
      const inversePatches = fsp.compare(curSn, prevSn)
      fn(patches as any, inversePatches as any)
    }
  })
}
