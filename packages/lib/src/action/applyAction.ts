import { resolvePathCheckingIds } from "../parent/path"
import type { Path } from "../parent/pathTypes"
import { getStandaloneAction } from "../standardActions/actions"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { CallKind } from "./CallKind"
import { resolveCallName } from "./resolveCallName"

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
   *
   * @deprecated Not needed with `createSerializer`: a `Call` is never serialized, an
   * `EncodedCall` always is.
   */
  readonly serialized?: boolean
}

/**
 * Applies (runs) an action over a target object.
 *
 * It runs any kind of action (built-in, standalone, model actions and flows), but not views.
 * To apply calls that come from outside (e.g. as JSON), decode them with a serializer
 * (`defaultSerializer.decodeCall`) and use `applyCall` / `applyCallAsync` instead, which check
 * what may be called.
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
  assertTweakedObject(current, "resolved target", true)

  const resolution = resolveCallName(current, call.actionName)
  if (resolution === "hook") {
    throw failure(`calls to hooks (${call.actionName}) cannot be applied`)
  }
  if (resolution === "unknown") {
    throw failure(`action '${call.actionName}' could not be resolved to a function`)
  }

  switch (resolution.kind) {
    case CallKind.View:
      throw failure(`action '${call.actionName}' is not a model action`)

    case CallKind.StandaloneAction:
    case CallKind.StandardAction:
      // the target is already the first argument
      return getStandaloneAction(call.actionName)!.fn(...call.args)

    default:
      return resolution.run(call.args) as TRet
  }
}
