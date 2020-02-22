import { assertTweakedObject } from "../tweaker/core"
import { lazy } from "../utils"
import { BuiltInAction } from "./builtInActions"
import { ActionContextActionType } from "./context"
import { wrapInAction } from "./wrapInAction"

type AnyFunction = (...args: any[]) => any

/**
 * Calls an object method wrapped in an action.
 *
 * @param node  Target object.
 * @param methodName Method name.
 */
export function applyCall<O extends object, K extends keyof O, FN extends O[K]>(
  node: O,
  methodName: K,
  ...args: FN extends AnyFunction ? Parameters<FN> : never
): FN extends AnyFunction ? ReturnType<FN> : never {
  assertTweakedObject(node, "node")

  return wrappedInternalApplyCall().call(node, methodName as string | number, args)
}

/**
 * @ignore
 * @internal
 */
export function internalApplyCall(this: any, methodName: string | number, args: any[]): any {
  return this[methodName](...args)
}

const wrappedInternalApplyCall = lazy(() =>
  wrapInAction(BuiltInAction.ApplyCall, internalApplyCall, ActionContextActionType.Sync)
)
