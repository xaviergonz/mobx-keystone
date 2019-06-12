import { action, isAction } from "mobx"
import { Writable } from "ts-essentials"
import { Model } from "../model/Model"
import { assertTweakedObject } from "../tweaker/core"
import { addHiddenProp, failure } from "../utils"
import {
  ActionContext,
  ActionContextActionType,
  getCurrentActionContext,
  setCurrentActionContext,
} from "./context"
import { getActionMiddlewares } from "./middleware"

const modelActionSymbol = Symbol("modelAction")

export function wrapInAction<T extends Function>(
  name: string,
  fn: T,
  actionType: ActionContextActionType,
  overrideContext?: (ctx: Writable<ActionContext>) => void
): T {
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
      type: actionType,
      target: this,
      args: Array.from(arguments),
      parentContext,
      data: {},
    }
    if (overrideContext) {
      overrideContext(context)
    }

    setCurrentActionContext(context)

    let mwareFn: () => any = fn.bind(this, ...arguments)
    getActionMiddlewares(this).forEach(mware => {
      const filterPassed = mware.filter ? mware.filter(context) : true
      if (filterPassed) {
        mwareFn = mware.middleware.bind(undefined, context, mwareFn)
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
