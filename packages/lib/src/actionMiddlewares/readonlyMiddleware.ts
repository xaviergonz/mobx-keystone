import { isHookAction } from "../action/hookActions"
import { ActionMiddlewareDisposer } from "../action/middleware"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  SimpleActionContext,
} from "./actionTrackingMiddleware"

/**
 * Return type for readonly middleware.
 */
export interface ReadonlyMiddlewareReturn {
  allowWrite<FN extends () => any>(fn: FN): ReturnType<FN>

  writeAllowed: boolean

  dispose: ActionMiddlewareDisposer
}

/**
 * Attaches an action middleware that will throw when any action is started
 * over the node or any of the child nodes, thus effectively making the subtree
 * readonly.
 *
 * It will return an object with a `dispose` function to remove the middleware and a `allowWrite` function
 * that will allow actions to be started inside the provided code block.
 *
 * Example:
 * ```ts
 * // given a model instance named todo
 * const { dispose, allowWrite } = readonlyMiddleware(todo)
 *
 * // this will throw
 * todo.setDone(false)
 * await todo.setDoneAsync(false)
 *
 * // this will work
 * allowWrite(() => todo.setDone(false))
 * // note: for async always use one action invocation per allowWrite!
 * await allowWrite(() => todo.setDoneAsync(false))
 * ```
 *
 * @param subtreeRoot Subtree root target object.
 * @returns An object with the middleware disposer (`dispose`) and a `allowWrite` function.
 */
export function readonlyMiddleware(subtreeRoot: object): ReadonlyMiddlewareReturn {
  assertTweakedObject(subtreeRoot, "subtreeRoot")

  let writable = false
  const writableSymbol = Symbol("writable")

  const disposer = actionTrackingMiddleware(subtreeRoot, {
    filter(ctx) {
      // skip hooks
      if (isHookAction(ctx.actionName)) {
        return false
      }

      // if we are inside allowWrite it is writable
      let currentlyWritable = writable

      if (!currentlyWritable) {
        // if a parent context was writable then the child should be as well
        let currentCtx: SimpleActionContext | undefined = ctx
        while (currentCtx && !currentlyWritable) {
          currentlyWritable = !!currentCtx.data[writableSymbol]
          currentCtx = currentCtx.parentContext
        }
      }

      if (currentlyWritable) {
        ctx.data[writableSymbol] = true
        return false
      }

      return true
    },

    onStart(ctx) {
      // if we get here (wasn't filtered out) it is not writable
      return {
        result: ActionTrackingResult.Throw,
        value: failure(`tried to invoke action '${ctx.actionName}' over a readonly node`),
      }
    },
  })

  return {
    dispose: disposer,

    get writeAllowed() {
      return writable
    },

    set writeAllowed(value: boolean) {
      writable = value
    },

    allowWrite(fn) {
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
