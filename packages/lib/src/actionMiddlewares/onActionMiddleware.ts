import { isObservable, toJS } from "mobx"
import { ActionCall } from "../action/applyAction"
import { ActionContext } from "../action/context"
import { isHookAction } from "../action/hookActions"
import {
  ActionMiddleware,
  ActionMiddlewareDisposer,
  addActionMiddleware,
} from "../action/middleware"
import { getRootPath } from "../parent/path"
import { getSnapshot } from "../snapshot/getSnapshot"
import { assertTweakedObject, isTweakedObject } from "../tweaker/core"
import { failure, isPlainObject, isPrimitive } from "../utils"

/**
 * A listener for `onActionMiddleware`.
 */
export type OnActionListener = (
  actionCall: ActionCall,
  actionContext: ActionContext,
  next: () => any
) => void

/**
 * Creates an action middleware that invokes a listener for all actions of a given tree.
 * Note that the listener will only be invoked for the topmost level actions, so it won't run for child actions or intermediary flow steps.
 * Also it won't trigger the listener for calls to hooks such as `onAttachedToRootStore` or its returned disposer.
 *
 * Its main use is to keep track of top level actions that can be later replicated via `applyAction` somewhere else (another machine, etc.).
 *
 * Remember to `return next()` if you want to continue the action, return something else if you want to change the return value
 * or throw if you want to cancel it.
 *
 * If you want to ensure that the actual action calls are serializable you should use either `serializeActionCallArgument` over the arguments
 * or `serializeActionCall` over the whole action before sending the action call over the wire / storing them .
 *
 * @param target Object with the root target object.
 * @param listener Listener function that will be invoked everytime a topmost action is invoked on the model or any children.
 * @returns The middleware disposer.
 */
export function onActionMiddleware(
  target: object,
  listener: OnActionListener
): ActionMiddlewareDisposer {
  assertTweakedObject(target, "target")

  const filter: ActionMiddleware["filter"] = ctx => {
    if (ctx.parentContext || ctx.previousAsyncStepContext) {
      // sub-action or async step, do nothing
      return false
    }

    // skip hooks
    if (isHookAction(ctx.actionName)) {
      return false
    }

    return true
  }

  return addActionMiddleware({
    middleware(ctx, next) {
      if (ctx.parentContext || ctx.previousAsyncStepContext) {
        // sub-action or async step, do nothing
        return next()
      }

      const actionCall = actionContextToActionCall(ctx)

      return listener(actionCall, ctx, next)
    },
    target,
    filter,
  })
}

function actionContextToActionCall(ctx: ActionContext): ActionCall {
  const rootPath = getRootPath(ctx.target)

  return {
    actionName: ctx.actionName,
    args: ctx.args,
    targetPath: rootPath.path,
  }
}

/**
 * Transforms an action call argument by returning its serializable equivalent.
 * In more detail, this will return the snapshot of models, the non observable equivalent of observable values,
 * or if it is a primitive then the primitive itself.
 * If the value cannot be serialized it will throw an exception.
 *
 * @param value Argument value to be transformed into its serializable form.
 * @returns The serializable form of the passed value.
 */
export function serializeActionCallArgument(value: any): any {
  if (isPrimitive(value)) {
    return value
  }
  if (isTweakedObject(value)) {
    return getSnapshot(value)
  }

  const origValue = value
  if (isObservable(value)) {
    value = toJS(value, { exportMapsAsObjects: false, detectCycles: false })
  }
  if (isPlainObject(value) || Array.isArray(value)) {
    return value
  }

  throw failure(`serializeActionCallArgument could not serialize the given value: ${origValue}`)
}

/**
 * Ensures that an action call is serializable by mapping the action arguments into its
 * serializable version by using `serializeActionCallArgument`.
 *
 * @param actionCall Action call to convert.
 * @returns The serializable action call.
 */
export function serializeActionCall(actionCall: ActionCall): ActionCall {
  return {
    ...actionCall,
    args: actionCall.args.map(serializeActionCallArgument),
  }
}
