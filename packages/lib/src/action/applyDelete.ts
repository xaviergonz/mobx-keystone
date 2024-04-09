import { remove } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { lazy } from "../utils"
import { BuiltInAction } from "./builtInActions"
import { ActionContextActionType } from "./context"
import { wrapInAction } from "./wrapInAction"

/**
 * Deletes an object field wrapped in an action.
 *
 * @param node  Target object.
 * @param fieldName Field name.
 */
export function applyDelete<O extends object, K extends keyof O>(node: O, fieldName: K): void {
  assertTweakedObject(node, "node", true)

  wrappedInternalApplyDelete().call(node, fieldName as string | number)
}

/**
 * @internal
 */
export function internalApplyDelete<O extends object>(this: O, fieldName: string | number): void {
  remove(this, String(fieldName))
}

const wrappedInternalApplyDelete = lazy(() =>
  wrapInAction({
    nameOrNameFn: BuiltInAction.ApplyDelete,
    fn: internalApplyDelete,
    actionType: ActionContextActionType.Sync,
  })
)
