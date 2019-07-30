import { isHookAction } from "../action/hookActions"
import { ActionMiddlewareDisposer } from "../action/middleware"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { actionTrackingMiddleware, ActionTrackingResult } from "./actionTrackingMiddleware"

/**
 * Return type for readonly middleware.
 */
export interface ReadonlyMiddlewareReturn {
  writable<FN extends () => R, R>(fn: FN): R

  dispose: ActionMiddlewareDisposer
}

/**
 * Attaches an action middleware that will throw when any action is started
 * over the node or any of the child nodes, thus effectively making the subtree
 * readonly.
 *
 * It will return an object with a `dispose` function to remove the middleware and a `writable` function
 * that will allow actions to be started inside the provided code block.
 *
 * Example:
 * ```ts
 * // given a model instance named todo
 * const { dispose, writable } = readonlyMiddleware(todo)
 *
 * // this will throw
 * todo.setDone(false)
 * await todo.setDoneAsync(false)
 *
 * // this will work
 * writable(() => todo.setDone(false))
 * // note: for async always use one action invocation per writable!
 * await writable(() => todo.setDoneAsync(false))
 * ```
 *
 * @param subtreeRoot Subtree root target object.
 * @returns An object with the middleware disposer (`dispose`) and a `writable` function.
 */
export function readonlyMiddleware(subtreeRoot: object): ReadonlyMiddlewareReturn {
  assertTweakedObject(subtreeRoot, "subtreeRoot")

  let writable = false

  const disposer = actionTrackingMiddleware(subtreeRoot, {
    filter(ctx) {
      if (ctx.parentContext) {
        // sub-action, do nothing
        return false
      }

      // skip hooks
      if (isHookAction(ctx.actionName)) {
        return false
      }

      return true
    },

    onStart(ctx) {
      if (!writable) {
        return {
          result: ActionTrackingResult.Throw,
          value: failure(`tried to invoke action '${ctx.actionName}' over a readonly node`),
        }
      } else {
        return undefined
      }
    },
  })

  return {
    dispose: disposer,
    writable(fn) {
      const oldWritable = writable
      writable = true
      try {
        return fn()
      } finally {
        writable = oldWritable
      }
    },
  }
}
