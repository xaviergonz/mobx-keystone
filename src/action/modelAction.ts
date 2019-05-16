import { isAction, action } from "mobx"
import { ActionContext, getCurrentActionContext, setCurrentActionContext } from "./context"
import { getActionMiddlewares } from "./middleware"
import { addHiddenProp } from "../_utils"

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

export function isModelAction(fn: any) {
  return typeof fn === "function" && fn[modelActionSymbol]
}

function checkModelActionArgs(propertyKey: string) {
  if (typeof propertyKey !== "string") {
    throw fail("modelAction cannot be used over symbol properties")
  }
  // TODO: check target is a model object or prototype
}

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
