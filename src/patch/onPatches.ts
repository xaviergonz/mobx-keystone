import { assertTweakedObject } from "../tweaker/core"
import { addPatchListener, OnPatchesListener, OnPatchesListenerDisposer } from "./emitPatch"

export function onPatches(obj: object, listener: OnPatchesListener): OnPatchesListenerDisposer {
  assertTweakedObject(obj, "onPatches")

  return addPatchListener(obj, listener)
}
