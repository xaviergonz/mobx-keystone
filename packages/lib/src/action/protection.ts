import { runInAction } from "mobx"
import { failure } from "../utils"
import { getCurrentActionContext } from "./context"
import { runPendingActions } from "./pendingActions"

/**
 * @ignore
 * @internal
 */
export function canWrite(): boolean {
  return !getActionProtection() || !!getCurrentActionContext()
}

/**
 * @ignore
 * @internal
 */
export function assertCanWrite() {
  if (!canWrite()) {
    throw failure("data changes must be performed inside model actions")
  }
}

let actionProtection = true

/**
 * @ignore
 * @internal
 *
 * Gets if the action protection is currently enabled or not.
 *
 * @returns
 */
export function getActionProtection() {
  return actionProtection
}

/**
 * Runs a block in unprocted mode, as if it were run inside a model action.
 * Consider using a proper model action instead since these kind of actions are not recorded.
 *
 * @typeparam T Return type.
 * @param name Mobx action name.
 * @param fn Action block.
 * @returns
 */
export function runUnprotected<T>(name: string, fn: () => T): T

/**
 * Runs a block in unprocted mode, as if it were run inside a model action.
 * Consider using a proper model action instead since these kind of actions are not recorded.
 *
 * @typeparam T Return type.
 * @param fn Action block.
 * @returns
 */
export function runUnprotected<T>(fn: () => T): T

// base case
export function runUnprotected<T>(arg1: any, arg2?: any): T {
  const name = typeof arg1 === "string" ? arg1 : undefined
  const fn: () => T = typeof arg1 === "string" ? arg2 : arg1

  const oldActionProtection = actionProtection
  actionProtection = false
  try {
    if (name) {
      return runInAction(name, fn)
    } else {
      return runInAction(fn)
    }
  } finally {
    actionProtection = oldActionProtection

    // execute pending actions (attach/detach from root store events)
    runPendingActions()
  }
}
