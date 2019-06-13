import { Model } from "../model/Model"
import { addHiddenProp, failure } from "../utils"
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
  if (typeof propertyKey !== "string") {
    throw failure("modelAction cannot be used over symbol properties")
  }

  const errMessage = "modelAction must be used over model classes or instances"

  if (!target) {
    throw failure(errMessage)
  }

  // check target is a model object or extended class
  if (!(target instanceof Model) && target !== Model && !(target.prototype instanceof Model)) {
    throw failure(errMessage)
  }
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
  if (baseDescriptor) {
    // method decorator
    const fn = baseDescriptor.value
    checkModelActionArgs(target, propertyKey, fn)

    return {
      enumerable: false,
      writable: true,
      configurable: true,
      value: wrapInAction(propertyKey, fn, ActionContextActionType.Sync),
    } as any
  } else {
    // field decorator
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: false,
      get() {
        return undefined
      },
      set(value) {
        const fn = value
        checkModelActionArgs(this, propertyKey, fn)

        addHiddenProp(
          this,
          propertyKey,
          wrapInAction(propertyKey, fn, ActionContextActionType.Sync)
        )
      },
    })
  }
}
