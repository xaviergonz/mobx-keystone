import { action } from "mobx"
import { finishMutationBatch, startMutationBatch } from "./mutationBatch"
import { tryRunPendingActions } from "./pendingActions"
import { getActionProtection, setActionProtection } from "./protection"

/**
 * Runs a block in unprotected mode, as if it were run inside a model action.
 * Structural mutations share one synchronous mutation batch, but the block is
 * not recorded as an action. Consider using a proper model action when action
 * recording is needed.
 *
 * @template T Return type.
 * @param name Mobx action name.
 * @param fn Action block.
 * @returns
 */
export function runUnprotected<T>(name: string, fn: () => T): T

/**
 * Runs a block in unprotected mode, as if it were run inside a model action.
 * Structural mutations share one synchronous mutation batch, but the block is
 * not recorded as an action. Consider using a proper model action when action
 * recording is needed.
 *
 * @template T Return type.
 * @param fn Action block.
 * @returns
 */
export function runUnprotected<T>(fn: () => T): T

// base case
export function runUnprotected<T>(arg1: any, arg2?: any): T {
  const name = typeof arg1 === "string" ? arg1 : undefined
  const fn: () => T = typeof arg1 === "string" ? arg2 : arg1

  let mutationBatchOwner = false
  const innerAction = () => {
    mutationBatchOwner = startMutationBatch()
    const oldActionProtection = getActionProtection()
    setActionProtection(false)

    try {
      return fn()
    } finally {
      setActionProtection(oldActionProtection)

      tryRunPendingActions()
    }
  }

  try {
    if (name) {
      return action(name, innerAction)()
    } else {
      return action(innerAction)()
    }
  } finally {
    if (mutationBatchOwner) {
      finishMutationBatch()
    }
  }
}
