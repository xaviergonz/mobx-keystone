import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import type { AnyModel } from "../model/BaseModel"
import { getModelMetadata } from "../model/getModelMetadata"
import { isModel } from "../model/utils"
import { dataToModelNode } from "../parent/core"
import { findParent } from "../parent/findParent"
import { internalApplyPatches } from "../patch/applyPatches"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { internalApplySnapshot } from "../snapshot/applySnapshot"
import { invalidateCachedTypeCheckerResult } from "../types/TypeChecker"
import { runWithoutSnapshotOrPatches } from "./core"
import { isTypeCheckingAllowed } from "./withoutTypeChecking"

/**
 * @internal
 */
export function runTypeCheckingAfterChange(
  obj: object,
  patchRecorder: InternalPatchRecorder | undefined,
  snapshotBeforeChanges?: object
) {
  if (!isTypeCheckingAllowed()) {
    return
  }

  // invalidate type check cached result
  invalidateCachedTypeCheckerResult(obj)

  if (isModelAutoTypeCheckingEnabled()) {
    const parentModelWithTypeChecker = findNearestParentModelWithTypeChecker(obj)
    if (parentModelWithTypeChecker) {
      const err = parentModelWithTypeChecker.typeCheck()
      if (err) {
        // quietly apply inverse patches (do not generate patches, snapshots, actions, etc)
        runWithoutSnapshotOrPatches(() => {
          if (patchRecorder) {
            internalApplyPatches.call(obj, patchRecorder.invPatches, true)
          } else if (snapshotBeforeChanges) {
            internalApplySnapshot.call(obj, snapshotBeforeChanges)
          }
        })
        // at the end of apply patches it will be type checked again and its result cached once more
        err.throw(parentModelWithTypeChecker)
      }
    }
  }
}

/**
 * @internal
 *
 * Finds the closest parent model that has a type checker defined.
 *
 * @param child
 * @returns
 */
function findNearestParentModelWithTypeChecker(child: object): AnyModel | undefined {
  // child might be .$, so we need to check the parent model in that case
  const actualChild = dataToModelNode(child)

  if (child !== actualChild) {
    child = actualChild
    if (isModel(child) && !!getModelMetadata(child).dataType) {
      return child
    }
  }

  return findParent(child, (parent) => {
    return isModel(parent) && !!getModelMetadata(parent).dataType
  })
}
