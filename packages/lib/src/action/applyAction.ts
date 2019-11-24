import { assertIsModel } from "../model/utils"
import { detach } from "../parent/detach"
import { resolvePathCheckingIds } from "../parent/path"
import { Path } from "../parent/pathTypes"
import { applyPatches } from "../patch/applyPatches"
import { applySnapshot } from "../snapshot/applySnapshot"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { BuiltInAction, isBuiltInAction } from "./builtInActions"
import { isHookAction } from "./hookActions"

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
   * Path to the model where the action will be run, as an array of string | number.
   */
  readonly targetPath: Path

  /**
   * Ids of models along the path to the target, null if it is not a model.
   */
  readonly targetPathIds: ReadonlyArray<string | null>

  /**
   * Marks this action call as non-serialized.
   */
  readonly serialized?: undefined
}

/**
 * Applies (runs) an action over a target object.
 *
 * If you intend to apply serialized actions check one of the `applySerializedAction` methods instead.
 *
 * @param subtreeRoot Subtree root target object to run the action over.
 * @param call The action, usually as coming from `onActionMiddleware`.
 * @returns The return value of the action, if any.
 */
export function applyAction<TRet = any>(subtreeRoot: object, call: ActionCall): TRet {
  if (call.serialized) {
    throw failure(
      "cannot apply a serialized action call, use one of the 'applySerializedAction' methods instead"
    )
  }

  assertTweakedObject(subtreeRoot, "subtreeRoot")

  // resolve path while checking ids
  const { value: current, resolved } = resolvePathCheckingIds(
    subtreeRoot,
    call.targetPath,
    call.targetPathIds
  )
  if (!resolved) {
    throw failure(
      `object at path ${JSON.stringify(call.targetPath)} with ids ${JSON.stringify(
        call.targetPathIds
      )} could not be resolved`
    )
  }
  assertIsModel(current, `resolved ${current}`)

  if (isBuiltInAction(call.actionName)) {
    switch (call.actionName) {
      case BuiltInAction.ApplySnapshot:
        return applySnapshot.apply(current, [current, ...call.args] as any) as any

      case BuiltInAction.ApplyPatches:
        return applyPatches.apply(current, [current, ...call.args] as any) as any

      case BuiltInAction.Detach:
        return detach.apply(current, [current, ...call.args] as any) as any

      default:
        throw failure(`assertion error: unknown built-in action - ${call.actionName}`)
    }
  } else if (isHookAction(call.actionName)) {
    throw failure(`calls to hooks (${call.actionName}) cannot be applied`)
  } else {
    return (current as any)[call.actionName].apply(current, call.args)
  }
}
