import { checkModelDecoratorArgs } from "../model/Model"
import { decorateWrapMethodOrField, failure } from "../utils"
import { ActionContextActionType } from "./context"
import { modelActionSymbol, wrapInAction } from "./wrapInAction"

/**
 * Returns if the given function is a model action or not.
 *
 * @param fn Function to check.
 * @returns
 */
export function isModelAction(fn: any) {
  return typeof fn === "function" && fn[modelActionSymbol]
}

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
        return wrapInAction(data.propertyKey, fn, ActionContextActionType.Sync)
      }
    }
  )
}
