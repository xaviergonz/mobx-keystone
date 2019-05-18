import * as fsp from "fast-json-patch"
import { onSnapshot } from "../snapshot"
import { PatchOperation } from "./PatchOperation"

export function onPatches(
  obj: object,
  fn: (patches: PatchOperation[], inversePatches: PatchOperation[]) => void
): () => void {
  // TODO: use immer ops instead to generate patches?
  return onSnapshot(obj, (curSn, prevSn) => {
    const patches = fsp.compare(prevSn, curSn)
    if (patches.length > 0) {
      const inversePatches = fsp.compare(curSn, prevSn)
      fn(patches as any, inversePatches as any)
    }
  })
}
