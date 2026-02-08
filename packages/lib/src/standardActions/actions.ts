import { ActionContextActionType } from "../action/context"
import { isModelAction } from "../action/isModelAction"
import { flow, isModelFlow } from "../action/modelFlow"
import { wrapInAction } from "../action/wrapInAction"
import { assertIsTreeNode } from "../tweaker/core"
import { assertIsFunction, failure, logWarning } from "../utils"
import { AnyFunction } from "../utils/AnyFunction"
import { copyFunctionMetadata } from "../utils/decorators"

/**
 * A function with an object as target.
 */
type TargetedAction = AnyFunction

const standaloneActionRegistry = new Map<string, TargetedAction>()

/**
 * @internal
 */
export function getStandaloneAction(actionName: string) {
  return standaloneActionRegistry.get(actionName)
}

/**
 * @internal
 */
export function addStandaloneAction(fullActionName: string, fn: TargetedAction, isFlow: boolean) {
  assertIsFunction(fn, fullActionName)

  if (standaloneActionRegistry.has(fullActionName)) {
    logWarning(
      "warn",
      `an standalone action with name "${fullActionName}" already exists (if you are using hot-reloading you may safely ignore this warning)`,
      `duplicateActionName - ${fullActionName}`
    )
  }

  if (isModelAction(fn)) {
    throw failure("the standalone action must not be previously marked as an action")
  }
  if (isModelFlow(fn)) {
    throw failure("the standalone action must not be previously marked as a flow action")
  }

  const wrappedAction = isFlow
    ? flow({ nameOrNameFn: fullActionName, generator: fn })
    : wrapInAction({
        nameOrNameFn: fullActionName,
        fn,
        actionType: ActionContextActionType.Sync,
      })

  const finalAction = (target: any, ...args: any[]) => {
    assertIsTreeNode(target, "target")

    // we need to put the target into this
    return wrappedAction.call(target, target, ...args)
  }
  // preserve user-provided metadata without leaking internal action/flow markers.
  copyFunctionMetadata(fn, finalAction)

  standaloneActionRegistry.set(fullActionName, finalAction)
  return finalAction
}
