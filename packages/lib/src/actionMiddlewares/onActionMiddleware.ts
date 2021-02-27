import type { ActionCall } from "../action/applyAction"
import { isHookAction } from "../action/hookActions"
import type { ActionMiddlewareDisposer } from "../action/middleware"
import { fastGetRootPath } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsObject } from "../utils"
import {
  actionTrackingMiddleware,
  ActionTrackingReturn,
  SimpleActionContext,
} from "./actionTrackingMiddleware"
import { rootPathToTargetPathIds } from "./utils"

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
  const rootPath = fastGetRootPath(ctx.target)

  return {
    actionName: ctx.actionName,
    args: ctx.args,
    targetPath: rootPath.path,
    targetPathIds: rootPathToTargetPathIds(rootPath),
  }
}
