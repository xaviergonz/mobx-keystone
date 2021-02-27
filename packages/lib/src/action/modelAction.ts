import { checkModelDecoratorArgs } from "../model/utils"
import { decorateWrapMethodOrField, failure } from "../utils"
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
          name: data.propertyKey,
          fn,
          actionType: ActionContextActionType.Sync,
        })
      }
    }
  )
}
