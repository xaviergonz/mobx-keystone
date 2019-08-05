import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { AnyModel } from "../model/BaseModel"
import { getModelDataType } from "../model/getModelDataType"
import { isModel } from "../model/utils"
import { findParent } from "../parent/findParent"
import { internalApplyPatches } from "../patch/applyPatches"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { invalidateCachedTypeCheckerResult } from "../typeChecking/TypeChecker"
import { runWithoutSnapshotOrPatches } from "./core"

/**
 * @ignore
 */
export function runTypeCheckingAfterChange(obj: object, patchRecorder: InternalPatchRecorder) {
  // invalidate type check cached result
  invalidateCachedTypeCheckerResult(obj)

  if (isModelAutoTypeCheckingEnabled()) {
    const parentModelWithTypeChecker = findNearestParentModelWithTypeChecker(obj)
    if (parentModelWithTypeChecker) {
      const err = parentModelWithTypeChecker.typeCheck()
      if (err) {
        // quietly apply inverse patches (do not generate patches, snapshots, actions, etc)
        runWithoutSnapshotOrPatches(() => {
          internalApplyPatches.call(obj, patchRecorder.invPatches)
        })
        // at the end of apply patches it will be type checked again and its result cached once more
        err.throw(parentModelWithTypeChecker)
      }
    }
  }
}

/**
 * @ignore
 *
 * Finds the closest parent model that has a type checker defined.
 *
 * @param child
 * @returns
 */
function findNearestParentModelWithTypeChecker(child: object): AnyModel | undefined {
  return findParent(child, parent => {
    return isModel(parent) && !!getModelDataType(parent)
  })
}
