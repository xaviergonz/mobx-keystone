import { AnyModel } from "../model/Model"
import { assertIsModel } from "../model/utils"
import { detach } from "../parent/detach"
import { resolvePath } from "../parent/path"
import { applyPatches } from "../patch/applyPatches"
import { applySnapshot } from "../snapshot/applySnapshot"
import { failure } from "../utils"
import { ActionContextActionType } from "./context"
import { isHookAction, SpecialAction } from "./specialActions"
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

  switch (call.actionName) {
    case SpecialAction.ApplySnapshot:
      return applySnapshot.apply(current, [current, ...call.args] as any)

    case SpecialAction.ApplyPatches:
      return applyPatches.apply(current, [current, ...call.args] as any)

    case SpecialAction.ApplyAction:
      return applyAction.apply(current, [current, ...call.args] as any)

    case SpecialAction.Detach:
      return detach.apply(current, [current, ...call.args] as any)

    default:
      break
  }

  if (isHookAction(call.actionName)) {
    throw failure(`calls to hooks (${call.actionName}) cannot be applied`)
  }

  return current[call.actionName].apply(current, call.args)
}

const wrappedInternalApplyAction = wrapInAction(
  SpecialAction.ApplyAction,
  internalApplyAction,
  ActionContextActionType.Sync
)
