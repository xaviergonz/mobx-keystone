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
 * ancestor (nearest-first / bottom-up). Stops early if the callback throws.
 */
function forEachTypedModelAncestor(obj: object, callback: (model: AnyModel) => void): void {
  // obj might be a $ data object, so resolve to the model if applicable
  let current: object | undefined = dataToModelNode(obj)

  // If we started from a $ data object, check the model itself
  if (current !== obj && isModelWithTypeChecker(current)) {
    callback(current)
  }

  // Logical parents skip model $ objects, visiting each model only once.
  while (current !== undefined) {
    const parent: object | undefined = fastGetParent(current, false)
    if (!parent) break

    if (isModelWithTypeChecker(parent)) {
      callback(parent)
    }

    current = parent
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
        // quietly apply inverse patches (do not generate patches, snapshots, actions, etc)
        // The re-entrancy guard prevents auto type checking during rollback:
        // rollback mutations trigger observe callbacks which call this function,
        // and with "all" scope those re-entrant checks could see partially-restored
        // intermediate state and attempt another rollback, causing infinite recursion.
        isRollingBackTypeCheckFailure = true
        try {
          runWithoutSnapshotOrPatches(() => {
            if (patchRecorder) {
              internalApplyPatches.call(obj, patchRecorder.invPatches, true)
            } else if (snapshotBeforeChanges) {
              internalApplySnapshot.call(obj, snapshotBeforeChanges)
            }
          })
        } finally {
          isRollingBackTypeCheckFailure = false
        }
        err.throw()
      }
    })
  }
}
