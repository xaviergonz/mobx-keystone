import { Model } from "../model/Model"
import { resolvePath } from "../parent/path"
import { applyPatches } from "../patch/applyPatches"
import { applySnapshot } from "../snapshot/applySnapshot"
import { failure } from "../utils"
import { ActionContextActionType } from "./context"
import { SpecialAction } from "./specialActions"
import { wrapInAction } from "./wrapInAction"

/**
 * An action call.
 */
export interface ActionCall {
  /**
   * Action name (name of the function).
   */
  readonly name: string
  /**
   * Action arguments.
   */
  readonly args: readonly any[]
  /**
   * Path to the subobject where the action will be run, as an array of strings.
   */
  readonly path: readonly string[]
}

/**
 * Applies (runs) a serialized action over a target model object.
 *
 * @param rootTarget Root target model object to run the action over.
 * @param call The serialized action, usually as coming from onAction.
 * @returns The return value of the action, if any.
 */
export function applyAction<TRet = any>(rootTarget: Model, call: ActionCall): TRet {
  if (!(rootTarget instanceof Model)) {
    throw failure("applyAction target must be a model object")
  }

  return wrappedInternalApplyAction.call(rootTarget, call)
}

function internalApplyAction(this: Model, call: ActionCall) {
  // resolve path
  const current = resolvePath(this, call.path)

  switch (call.name) {
    case SpecialAction.ApplySnapshot:
      return applySnapshot.apply(current, [current, ...call.args] as any)

    case SpecialAction.ApplyPatches:
      return applyPatches.apply(current, [current, ...call.args] as any)

    case SpecialAction.ApplyAction:
      return applyAction.apply(current, [current, ...call.args] as any)

    case SpecialAction.OnAttachedToRootStore:
      throw failure('calls to "onAttachedToRootStore" cannot be applied')

    case SpecialAction.OnAttachedToRootStoreDisposer:
      throw failure('calls to "onAttachedToRootStore" disposer cannot be applied')

    default:
      return current[call.name].apply(current, call.args)
  }
}

const wrappedInternalApplyAction = wrapInAction(
  SpecialAction.ApplyAction,
  internalApplyAction,
  ActionContextActionType.Sync
)
