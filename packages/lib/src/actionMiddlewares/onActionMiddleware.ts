import { isObservable, toJS } from "mobx"
import { ActionCall } from "../action/applyAction"
import { isHookAction } from "../action/hookActions"
import { ActionMiddlewareDisposer } from "../action/middleware"
import { isModelSnapshot } from "../model/utils"
import { getRootPath } from "../parent/path"
import { fromSnapshot } from "../snapshot/fromSnapshot"
import { getSnapshot } from "../snapshot/getSnapshot"
import { assertTweakedObject, isTweakedObject } from "../tweaker/core"
import { assertIsObject, failure, isPlainObject, isPrimitive } from "../utils"
import {
  actionTrackingMiddleware,
  ActionTrackingReturn,
  SimpleActionContext,
} from "./actionTrackingMiddleware"

/**
 * Attaches an action middleware that invokes a listener for all actions of a given tree.
 * Note that the listener will only be invoked for the topmost level actions, so it won't run for child actions or intermediary flow steps.
 * Also it won't trigger the listener for calls to hooks such as `onAttachedToRootStore` or its returned disposer.
 *
 * Its main use is to keep track of top level actions that can be later replicated via `applyAction` somewhere else (another machine, etc.).
 *
 * There are two kind of possible listeners, `onStart` and `onFinish` listeners.
 * `onStart` listeners are called before the action executes and allow cancellation by returning a new return value (which might be a return or a throw).
 * `onFinish` listeners are called after the action executes, have access to the action actual return value and allow overriding by returning a
 * new return value (which might be a return or a throw).
 *
 * If you want to ensure that the actual action calls are serializable you should use either `serializeActionCallArgument` over the arguments
 * or `serializeActionCall` over the whole action before sending the action call over the wire / storing them .
 *
 * @param subtreeRoot Subtree root target object.
 * @param listeners Listener functions that will be invoked everytime a topmost action is invoked on the model or any children.
 * @returns The middleware disposer.
 */
export function onActionMiddleware(
  subtreeRoot: object,
  listeners: {
    onStart?: (
      actionCall: ActionCall,
      actionContext: SimpleActionContext
    ) => void | ActionTrackingReturn
    onFinish?: (
      actionCall: ActionCall,
      actionContext: SimpleActionContext,
      ret: ActionTrackingReturn
    ) => void | ActionTrackingReturn
  }
): ActionMiddlewareDisposer {
  assertTweakedObject(subtreeRoot, "subtreeRoot")
  assertIsObject(listeners, "listeners")

  return actionTrackingMiddleware(subtreeRoot, {
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
      if (listeners.onStart) {
        const actionCall = actionContextToActionCall(ctx)
        return listeners.onStart(actionCall, ctx)
      }
    },

    onFinish(ctx, ret) {
      if (listeners.onFinish) {
        const actionCall = actionContextToActionCall(ctx)
        return listeners.onFinish(actionCall, ctx, ret)
      }
    },
  })
}

function actionContextToActionCall(ctx: SimpleActionContext): ActionCall {
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
 * @param argValue Argument value to be transformed into its serializable form.
 * @returns The serializable form of the passed value.
 */
export function serializeActionCallArgument(argValue: any): any {
  if (isPrimitive(argValue)) {
    return argValue
  }
  if (isTweakedObject(argValue)) {
    return getSnapshot(argValue)
  }

  const origValue = argValue
  if (isObservable(argValue)) {
    argValue = toJS(argValue, { exportMapsAsObjects: false, detectCycles: false })
  }
  if (isPlainObject(argValue) || Array.isArray(argValue)) {
    return argValue
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

/**
 * Transforms an action call argument by returning its deserialized equivalent.
 * In more detail, this will transform back the snapshot of models, and keep everything else as is.
 * If the value cannot be deserialized it will throw an exception.
 *
 * @param argValue Argument value to be transformed into its deserialized form.
 * @returns The deserialized form of the passed value.
 */
export function deserializeActionCallArgument(argValue: any): any {
  if (isModelSnapshot(argValue)) {
    return fromSnapshot(argValue)
  }

  return argValue
}

/**
 * Ensures that an action call is deserialized by mapping the action arguments into its
 * deserialized version by using `deserializeActionCallArgument`.
 *
 * @param actionCall Action call to convert.
 * @returns The deserialized action call.
 */
export function deserializeActionCall(actionCall: ActionCall): ActionCall {
  return {
    ...actionCall,
    args: actionCall.args.map(deserializeActionCallArgument),
  }
}
