import { failure } from "../utils"
import { decorateWrapMethodOrField } from "../utils/decorators"
import { ActionContextActionType } from "./context"
import { isModelAction } from "./isModelAction"
import { wrapInAction } from "./wrapInAction"

/**
 * Decorator that turns a function into a model action.
 */
export function modelAction(...args: any[]): void {
  // biome-ignore lint/correctness/noVoidTypeReturn: intended
  return decorateWrapMethodOrField("modelAction", args, (data, fn) => {
    if (isModelAction(fn)) {
      return fn
    } else {
      if (typeof fn !== "function") {
        throw failure("modelAction has to be used over functions")
      }

      return wrapInAction({
        nameOrNameFn: data.actionName,
        fn,
        actionType: ActionContextActionType.Sync,
        overrideContext: data.overrideContext,
      })
    }
  })
}
