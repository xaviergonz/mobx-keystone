import * as fsp from "fast-json-patch"
import { onSnapshot } from "./onSnapshot"

export function onPatch(
  obj: object,
  fn: (patches: fsp.Operation[], inversePatches: fsp.Operation[]) => void
): () => void {
  // TODO: use immer ops instead to generate patches?
  return onSnapshot(obj, (curSn, prevSn) => {
    const patches = fsp.compare(prevSn, curSn)
    if (patches.length > 0) {
      const inversePatches = fsp.compare(curSn, prevSn)
      fn(patches, inversePatches)
    }
  })
}
