import { Model } from "../model/Model"
import { resolvePath } from "../parent"
import { applyPatches, applyPatchesName } from "../patch/applyPatches"
import { applySnapshot } from "../snapshot"
import { applySnapshotName } from "../snapshot/applySnapshot"
import { failure } from "../utils"
import { ActionContextActionType } from "./context"
import { wrapInAction } from "./modelAction"
import { SerializableActionCall } from "./onAction"

export const applyActionName = "$$applyAction"

/**
 * Applies (runs) a serialized action over a target model object.
 *
 * @param rootTarget Root target model object to run the action over.
 * @param call The serialized action, usually as coming from onAction.
 * @returns The return value of the action, if any.
 */
export function applyAction<TRet = any>(rootTarget: Model, call: SerializableActionCall): TRet {
  if (!(rootTarget instanceof Model)) {
    throw failure("applyAction target must be a model object")
  }

  return wrappedInternalApplyAction.call(rootTarget, call)
}

function internalApplyAction(this: Model, call: SerializableActionCall) {
  // resolve path
  const current = resolvePath(this, call.path)

  switch (call.name) {
    case applySnapshotName:
      return applySnapshot.apply(current, [current, ...call.args] as any)

    case applyPatchesName:
      return applyPatches.apply(current, [current, ...call.args] as any)

    case applyActionName:
      return applyAction.apply(current, [current, ...call.args] as any)

    default:
      return current[call.name].apply(current, call.args)
  }
}

const wrappedInternalApplyAction = wrapInAction(
  applyActionName,
  internalApplyAction,
  ActionContextActionType.Sync
)
