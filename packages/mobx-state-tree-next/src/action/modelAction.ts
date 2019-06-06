import { action, isAction } from "mobx"
import { Model } from "../model/Model"
import { assertTweakedObject } from "../tweaker/core"
import { addHiddenProp, failure } from "../utils"
import { ActionContext, getCurrentActionContext, setCurrentActionContext } from "./context"
import { getActionMiddlewares } from "./middleware"

const modelActionSymbol = Symbol("modelAction")

export function wrapInAction<T extends Function>(name: string, fn: T): T {
  if (!isAction(fn)) {
    fn = action(name, fn)
  }

  function wrappedAction(this: any) {
    if (process.env.NODE_ENV !== "production") {
      assertTweakedObject(this, "wrappedAction")
    }

    const parentContext = getCurrentActionContext()

    const context: ActionContext = {
      name,
      target: this,
      args: Array.from(arguments),
      parentContext,
      data: {},
    }

    setCurrentActionContext(context)

    let mwareFn: () => any = fn.bind(this, ...arguments)
    getActionMiddlewares().forEach(mware => {
      const filterPassed = mware.filter ? mware.filter(context) : true
      if (filterPassed) {
        mwareFn = mware.fn.bind(undefined, context, mwareFn)
      }
    })

    try {
      return mwareFn()
    } finally {
      setCurrentActionContext(context.parentContext)
    }
  }
  ;(wrappedAction as any)[modelActionSymbol] = true

  return wrappedAction as any
}

/**
 * Returns if the given function is a model action or not.
 *
 * @param fn Function to check.
 * @returns
 */
export function isModelAction(fn: any) {
  return typeof fn === "function" && fn[modelActionSymbol]
}

function checkModelActionArgs(target: any, propertyKey: string) {
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
    checkModelActionArgs(target, propertyKey)

    return {
      enumerable: false,
      writable: true,
      configurable: true,
      value: wrapInAction(propertyKey, baseDescriptor.value),
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
        checkModelActionArgs(this, propertyKey)

        addHiddenProp(this, propertyKey, wrapInAction(propertyKey, value))
      },
    })
  }
}
