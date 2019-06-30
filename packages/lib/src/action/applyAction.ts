import { AnyModel } from "../model/Model"
import { assertIsModel } from "../model/utils"
import { detach } from "../parent/detach"
import { resolvePath } from "../parent/path"
import { applyPatches } from "../patch/applyPatches"
import { applySnapshot } from "../snapshot/applySnapshot"
import { failure } from "../utils"
import { BuiltInAction, isBuiltInAction } from "./builtInActions"
import { ActionContextActionType } from "./context"
import { isHookAction } from "./hookActions"
import { wrapInAction } from "./wrapInAction"

/**
 * An action call.
 */
export interface ActionCall {
  /**
   * Action name (name of the function).
   */
  readonly actionName: string
  /**
   * Action arguments.
   */
  readonly args: ReadonlyArray<any>
  /**
   * Path to the subobject where the action will be run, as an array of strings.
   */
  readonly targetPath: ReadonlyArray<string>
}

/**
 * Applies (runs) a serialized action over a target model object.
 *
 * @param rootTarget Root target model object to run the action over.
 * @param call The serialized action, usually as coming from `onActionMiddleware`.
 * @returns The return value of the action, if any.
 */
export function applyAction<TRet = any>(rootTarget: AnyModel, call: ActionCall): TRet {
  assertIsModel(rootTarget, "applyAction target")

  return wrappedInternalApplyAction.call(rootTarget, call)
}

function internalApplyAction(this: AnyModel, call: ActionCall) {
  // resolve path
  const current = resolvePath(this, call.targetPath)

  if (isBuiltInAction(call.actionName)) {
    switch (call.actionName) {
      case BuiltInAction.ApplySnapshot:
        return applySnapshot.apply(current, [current, ...call.args] as any)

      case BuiltInAction.ApplyPatches:
        return applyPatches.apply(current, [current, ...call.args] as any)

      case BuiltInAction.ApplyAction:
        return applyAction.apply(current, [current, ...call.args] as any)

      case BuiltInAction.Detach:
        return detach.apply(current, [current, ...call.args] as any)

      default:
        throw failure(`assertion error: unknown built-in action - ${call.actionName}`)
    }
  } else if (isHookAction(call.actionName)) {
    throw failure(`calls to hooks (${call.actionName}) cannot be applied`)
  } else {
    return current[call.actionName].apply(current, call.args)
  }
}

const wrappedInternalApplyAction = wrapInAction(
  BuiltInAction.ApplyAction,
  internalApplyAction,
  ActionContextActionType.Sync
)
