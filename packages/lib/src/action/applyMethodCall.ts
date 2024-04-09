import { AnyFunction } from "../utils/AnyFunction"
import { assertTweakedObject } from "../tweaker/core"
import { lazy } from "../utils"
import { BuiltInAction } from "./builtInActions"
import { ActionContextActionType } from "./context"
import { wrapInAction } from "./wrapInAction"

/**
 * Calls an object method wrapped in an action.
 *
 * @param node  Target object.
 * @param methodName Method name.
 */
export function applyMethodCall<O extends object, K extends keyof O, FN extends O[K]>(
  node: O,
  methodName: K,
  ...args: FN extends AnyFunction ? Parameters<FN> : never
): FN extends AnyFunction ? ReturnType<FN> : never {
  assertTweakedObject(node, "node")

  return wrappedInternalApplyMethodCall().call(node, methodName as string | number, args)
}

/**
 * @internal
 */
export function internalApplyMethodCall(this: any, methodName: string | number, args: any[]): any {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return this[methodName](...args)
}

const wrappedInternalApplyMethodCall = lazy(() =>
  wrapInAction({
    nameOrNameFn: BuiltInAction.ApplyMethodCall,
    fn: internalApplyMethodCall,
    actionType: ActionContextActionType.Sync,
  })
)
