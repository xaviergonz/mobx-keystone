import { action, isAction } from "mobx"
import { addHiddenProp, failure } from "../utils"
import { ActionContext, getCurrentActionContext, setCurrentActionContext } from "./context"
import { getActionMiddlewares } from "./middleware"

const modelActionSymbol = Symbol("modelAction")

function wrapInAction<T extends Function>(name: string, fn: T): T {
  if (!isAction(fn)) {
    fn = action(name, fn)
  }

  function wrappedAction(this: any) {
    const context: ActionContext = {
      name,
      target: this,
      args: Array.from(arguments),
      parentContext: getCurrentActionContext(),
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
 * @export
 * @param fn Function to check.
 * @returns
 */
export function isModelAction(fn: any) {
  return typeof fn === "function" && fn[modelActionSymbol]
}

function checkModelActionArgs(propertyKey: string) {
  if (typeof propertyKey !== "string") {
    throw failure("modelAction cannot be used over symbol properties")
  }
  // TODO: check target is a model object or prototype
}

/**
 * Decorator that turns a function into a model action.
 *
 * @export
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
    checkModelActionArgs(propertyKey)

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
        checkModelActionArgs(propertyKey)

        addHiddenProp(this, propertyKey, wrapInAction(propertyKey, value))
      },
    })
  }
}
