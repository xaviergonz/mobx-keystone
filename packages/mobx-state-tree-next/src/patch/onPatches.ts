import { assertTweakedObject } from "../tweaker/core"
import { addPatchListener, OnPatchesListener, OnPatchesListenerDisposer } from "./emitPatch"

/**
 * Adds a listener that will be called every time a patch is generated for the tree of the given target object.
 *
 * @param obj Root object of the patch listener.
 * @param listener The listener function that will be called everytime a patch is generated for the object or its children.
 * @returns A disposer to stop listening to patches.
 */
export function onPatches(obj: object, listener: OnPatchesListener): OnPatchesListenerDisposer {
  assertTweakedObject(obj, "onPatches")

  return addPatchListener(obj, listener)
}
