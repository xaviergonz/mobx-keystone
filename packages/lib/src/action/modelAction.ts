import { checkModelDecoratorArgs } from "../modelShared/checkModelDecoratorArgs"
import { decorateWrapMethodOrField, failure } from "../utils"
import { getActionNameAndContextOverride } from "./actionDecoratorUtils"
import { ActionContextActionType } from "./context"
import { isModelAction } from "./isModelAction"
import { wrapInAction } from "./wrapInAction"

function checkModelActionArgs(target: any, propertyKey: string, value: any) {
  if (typeof value !== "function") {
    throw failure("modelAction has to be used over functions")
  }
  checkModelDecoratorArgs("modelAction", target, propertyKey)
}

/**
 * Decorator that turns a function into a model action.
 *
 * @param target
 * @param propertyKey
 * @param [baseDescriptor]
 * @returns
 */
export function modelAction(
  target: any,
  propertyKey: string,
  baseDescriptor?: PropertyDescriptor
): void {
  const { actionName, overrideContext } = getActionNameAndContextOverride(target, propertyKey)

  return decorateWrapMethodOrField(
    "modelAction",
    {
      target,
      propertyKey,
      baseDescriptor,
    },
    (data, fn) => {
      if (isModelAction(fn)) {
        return fn
      } else {
        checkModelActionArgs(data.target, data.propertyKey, fn)

        return wrapInAction({
          nameOrNameFn: actionName,
          fn,
          actionType: ActionContextActionType.Sync,
          overrideContext,
        })
      }
    }
  )
}
