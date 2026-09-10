import { type IArrayDidChange, type IObjectDidChange, remove, set } from "mobx"
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
import { isTypeCheckingAllowed, withoutTypeChecking } from "./withoutTypeChecking"

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

interface TypeCheckingBatch {
  models: Set<AnyModel>
  undo: (() => void)[]
  recording: boolean
  /** Last recorded change target, so a run of changes to it walks ancestors once. */
  previousTarget?: object
}

let typeCheckingBatch: TypeCheckingBatch | undefined

/** @internal Called only when automatic type checking is enabled. */
export function typeCheckAfterCreation(model: AnyModel): void {
  if (typeCheckingBatch?.recording) {
    typeCheckingBatch.models.add(model)
  } else {
    const error = model.typeCheck()
    if (error) error.throw()
  }
}

/**
 * @internal
 * Capture stored values before any listener can mutate them again. Restoring
 * live values preserves identity and literal data, without snapshot processors
 * or model defaults changing the state being restored.
 */
export function recordTypeCheckingBatchChange(change: IObjectDidChange | IArrayDidChange): void {
  const batch = typeCheckingBatch
  if (!batch?.recording) return
  if (
    change.type === "splice" &&
    change.addedCount === change.removedCount &&
    change.added.every((value, index) => value === change.removed[index])
  )
    return

  const target = change.object
  if (target !== batch.previousTarget) {
    forEachTypedModelAncestor(target, (model) => batch.models.add(model))
    batch.previousTarget = target
  }

  if (change.type === "splice") {
    const { object, index, addedCount } = change
    const removed = change.removed.slice()
    batch.undo.push(() => object.spliceWithArray(index, addedCount, removed))
  } else if ("index" in change) {
    const { object, index, oldValue } = change
    batch.undo.push(() => {
      object[index] = oldValue
    })
  } else {
    const { object } = change
    const key = change.name as string
    if (change.type === "add") {
      batch.undo.push(() => remove(object, key))
    } else {
      const { oldValue } = change
      batch.undo.push(() => set(object, key, oldValue))
    }
  }
}

/**
 * @internal
 * Nested calls and synchronous listener edits join the same validation batch.
 * Rollback publishes compensating changes, just like snapshot reconciliation.
 */
export function withTypeCheckingBatch(fn: () => void): void {
  if (typeCheckingBatch || !isTypeCheckingAfterChangeEnabled()) {
    fn()
    return
  }

  const batch: TypeCheckingBatch = { models: new Set(), undo: [], recording: true }
  typeCheckingBatch = batch
  let validating = false
  try {
    withoutTypeChecking(fn)
    // MobX has now invalidated dependencies, including added/removed keys.
    validating = true
    for (const model of batch.models) {
      const error = model.typeCheck()
      if (error) error.throw()
    }
  } catch (error) {
    // Only a rejected validation rolls back. Errors thrown by the batch body
    // itself (an invalid patch, a throwing listener) keep the same partial
    // application they produce while automatic type checking is disabled.
    if (validating) {
      batch.recording = false
      withoutTypeChecking(() => {
        for (let i = batch.undo.length - 1; i >= 0; i--) {
          try {
            batch.undo[i]()
          } catch {
            // Keep restoring after a rollback listener throws. The original
            // failure takes precedence over errors from compensating changes.
          }
        }
      })
    }
    throw error
  } finally {
    typeCheckingBatch = undefined
  }
}
