import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import type { AnyModel } from "../model/BaseModel"
import { getModelMetadata } from "../model/getModelMetadata"
import { isModel } from "../model/utils"
import { dataToModelNode } from "../parent/core"
import { fastGetParent } from "../parent/path"
import { internalApplyPatches } from "../patch/applyPatches"
import type { InternalPatchRecorder } from "../patch/emitPatch"
import { internalApplySnapshot } from "../snapshot/applySnapshot"
import { runWithoutSnapshotOrPatches } from "./core"
import { isTypeCheckingAllowed } from "./withoutTypeChecking"

// Re-entrancy guard: when true, we are inside a type-check rollback.
// During rollback, observe callbacks still fire, but we skip the auto
// type checking to avoid infinite recursion (rollback mutations trigger
// this function again, and with "all" scope the intermediate state may
// still be invalid, causing another rollback attempt).
let isRollingBackTypeCheckFailure = false

/**
 * @internal
 */
export function isTypeCheckingAfterChangeEnabled(): boolean {
  return (
    isTypeCheckingAllowed() && isModelAutoTypeCheckingEnabled() && !isRollingBackTypeCheckFailure
  )
}

function isModelWithTypeChecker(obj: object): obj is AnyModel {
  return isModel(obj) && !!getModelMetadata(obj).dataType
}

/**
 * @internal
 *
 * Walks up parent chain from `obj`, calling `callback` for each typed model
 * including the target itself (nearest-first / bottom-up). Stops if the callback throws.
 */
function forEachTypedModelAncestor(obj: object, callback: (model: AnyModel) => void): void {
  // obj might be a $ data object, so resolve to the model if applicable
  const start = dataToModelNode(obj)

  // Both model-data mutations and whole-model reconciliation must validate
  // the model itself before checking its ancestors.
  if (isModelWithTypeChecker(start)) {
    callback(start)
  }

  // Raw parents never point to model $ objects, so each model is visited once.
  let parent: object | undefined = fastGetParent(start, false)
  while (parent) {
    if (isModelWithTypeChecker(parent)) {
      callback(parent)
    }
    parent = fastGetParent(parent, false)
  }
}

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

  if (patchRecorder && !patchRecorder.hasChanges) {
    // No patches means no effective change.
    return
  }

  if (isModelAutoTypeCheckingEnabled() && !isRollingBackTypeCheckFailure) {
    forEachTypedModelAncestor(obj, (model) => {
      const err = model.typeCheck()
      if (err) {
        // A rejected individual mutation has not updated its snapshot yet,
        // so inverse patches must stay quiet. Snapshot reconciliation has
        // already published changes: its rollback must update snapshots and
        // emit compensating patches as well.
        isRollingBackTypeCheckFailure = true
        try {
          if (patchRecorder) {
            runWithoutSnapshotOrPatches(() => {
              internalApplyPatches.call(obj, patchRecorder.invPatches, true)
            })
          } else if (snapshotBeforeChanges) {
            internalApplySnapshot.call(obj, snapshotBeforeChanges)
          }
        } finally {
          isRollingBackTypeCheckFailure = false
        }
        err.throw()
      }
    })
  }
}
