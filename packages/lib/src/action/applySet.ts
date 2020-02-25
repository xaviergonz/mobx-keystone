import { isObservable, set } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { lazy } from "../utils"
import { BuiltInAction } from "./builtInActions"
import { ActionContextActionType } from "./context"
import { wrapInAction } from "./wrapInAction"

/**
 * Sets an object field wrapped in an action.
 *
 * @param node  Target object.
 * @param fieldName Field name.
 * @param value Value to set.
 */
export function applySet<O extends object, K extends keyof O, V extends O[K]>(
  node: O,
  fieldName: K,
  value: V
): void {
  assertTweakedObject(node, "node")

  wrappedInternalApplySet().call(node, fieldName as string | number, value)
}

/**
 * @ignore
 * @internal
 */
export function internalApplySet<O extends object>(
  this: O,
  fieldName: string | number,
  value: any
): void {
  if (isObservable(this)) {
    set(this, fieldName, value)
  } else {
    ;(this as any)[fieldName] = value
  }
}

const wrappedInternalApplySet = lazy(() =>
  wrapInAction(BuiltInAction.ApplySet, internalApplySet, ActionContextActionType.Sync)
)
