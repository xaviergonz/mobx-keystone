import { action } from "mobx"
import { tryRunPendingActions } from "./pendingActions"
import { getActionProtection, setActionProtection } from "./protection"

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

  const innerAction = () => {
    const oldActionProtection = getActionProtection()
    setActionProtection(false)

    try {
      return fn()
    } finally {
      setActionProtection(oldActionProtection)

      tryRunPendingActions()
    }
  }

  if (name) {
    return action(name, innerAction)()
  } else {
    return action(innerAction)()
  }
}
