import { type IArrayDidChange, type IObjectDidChange, remove, set } from "mobx"
import type { AnyModel } from "../model/BaseModel"
import type { DelayedError } from "../utils/forEachWithDelayedThrow"
import { forEachTypedModelAncestor, isTypeCheckingAfterChangeEnabled } from "./typeChecking"
import { withoutTypeChecking } from "./withoutTypeChecking"

// Rolling back tree changes that failed partway (not to be confused with the
// undo manager, which records user-level history): a change batch makes
// `applySnapshot` / `applyPatches` all or nothing, and rollback recorders make
// transactions revertible. Both restore the live values each change replaced.

interface ChangeBatch {
  /** Whether the changed models are type checked when the batch completes. */
  validate: boolean
  models: Set<AnyModel>
  /** How to revert each recorded change, oldest first. */
  reverts: (() => void)[]
  recording: boolean
  /** Last recorded change target, so a run of changes to it walks ancestors once. */
  previousTarget?: object
}

let changeBatch: ChangeBatch | undefined

const noListenerError = Symbol("noListenerError")
let lastListenerError: unknown = noListenerError

/**
 * @internal
 * Rethrows the errors thrown by the listeners of an applied change. A change
 * batch does not roll back for them: the change itself was valid.
 */
export function throwDelayedListenerError(delayedError: DelayedError): void {
  if (delayedError) {
    lastListenerError = delayedError.value
    throw delayedError.value
  }
}

/**
 * @internal
 * Leaves the type check of a new model to the validating change batch being
 * recorded, if any. Returns whether it did.
 */
export function deferModelTypeCheckToBatch(model: AnyModel): boolean {
  if (changeBatch?.recording && changeBatch.validate) {
    changeBatch.models.add(model)
    return true
  }
  return false
}

/**
 * @internal
 * Records how to revert every change made while `recording` is set, wherever
 * it happens, until disposed. Used to roll back failed transactions.
 */
export class ChangeRollbackRecorder {
  recording = false
  readonly reverts: (() => void)[] = []

  constructor() {
    rollbackRecorders.add(this)
  }

  dispose(): void {
    rollbackRecorders.delete(this)
  }
}

const rollbackRecorders = new Set<ChangeRollbackRecorder>()

// (a suspended transaction keeps its recorder without recording)
function isAnyRollbackRecorderRecording(): boolean {
  for (const recorder of rollbackRecorders) {
    if (recorder.recording) {
      return true
    }
  }
  return false
}

/**
 * @internal
 * Records how to revert a change for the change batch and the rollback
 * recorders. It captures stored values before any listener can mutate them again. Restoring
 * live values preserves identity and literal data, without snapshot processors
 * or model defaults changing the state being restored.
 */
export function recordChangeForRollback(change: IObjectDidChange | IArrayDidChange): void {
  const batch = changeBatch?.recording ? changeBatch : undefined
  if (!batch && !isAnyRollbackRecorderRecording()) return
  if (
    change.type === "splice" &&
    change.addedCount === change.removedCount &&
    change.added.every((value, index) => value === change.removed[index])
  )
    return

  const target = change.object
  if (batch?.validate && target !== batch.previousTarget) {
    forEachTypedModelAncestor(target, (model) => batch.models.add(model))
    batch.previousTarget = target
  }

  const revert = createRevert(change)
  batch?.reverts.push(revert)
  for (const recorder of rollbackRecorders) {
    if (recorder.recording) {
      recorder.reverts.push(revert)
    }
  }
}

function createRevert(change: IObjectDidChange | IArrayDidChange): () => void {
  if (change.type === "splice") {
    const { object, index, addedCount } = change
    const removed = change.removed.slice()
    return () => object.spliceWithArray(index, addedCount, removed)
  }
  if ("index" in change) {
    const { object, index, oldValue } = change
    return () => {
      object[index] = oldValue
    }
  }
  const { object } = change
  const key = change.name as string
  if (change.type === "add") {
    return () => remove(object, key)
  }
  const { oldValue } = change
  return () => set(object, key, oldValue)
}

/**
 * Reverts the changes recorded since `start`, newest first. Rollback publishes
 * compensating changes, just like snapshot reconciliation.
 */
function rollBackBatch(batch: ChangeBatch, start: number): void {
  batch.recording = false
  try {
    withoutTypeChecking(() => {
      for (let i = batch.reverts.length - 1; i >= start; i--) {
        try {
          batch.reverts[i]()
        } catch {
          // Keep restoring after a rollback listener throws. The original
          // failure takes precedence over errors from compensating changes.
        }
      }
    })
  } finally {
    batch.reverts.length = start
    batch.recording = true
  }
}

/**
 * @internal
 * Applies the changes made by `fn` as a whole: when it throws, or when the
 * changed models fail automatic type checking afterwards, the changes are
 * rolled back before the error is rethrown. Errors thrown by the listeners of
 * a change do not roll back, since the change itself was valid.
 * A nested call only rolls back its own changes, while validation runs once
 * the outermost call completes. Synchronous listener edits join the batch.
 */
export function withChangeBatch(fn: () => void): void {
  const outer = changeBatch
  if (outer) {
    if (!outer.recording) {
      // (rolling back)
      fn()
      return
    }
    const start = outer.reverts.length
    try {
      fn()
    } catch (error) {
      if (error !== lastListenerError) {
        rollBackBatch(outer, start)
      }
      throw error
    }
    return
  }

  const batch: ChangeBatch = {
    validate: isTypeCheckingAfterChangeEnabled(),
    models: new Set(),
    reverts: [],
    recording: true,
  }
  changeBatch = batch
  lastListenerError = noListenerError
  let validating = false
  try {
    if (batch.validate) {
      withoutTypeChecking(fn)
      // MobX has now invalidated dependencies, including added/removed keys.
      validating = true
      for (const model of batch.models) {
        const error = model.typeCheck()
        if (error) error.throw()
      }
    } else {
      fn()
    }
  } catch (error) {
    if (validating || error !== lastListenerError) {
      rollBackBatch(batch, 0)
    }
    throw error
  } finally {
    changeBatch = undefined
    lastListenerError = noListenerError
  }
}
