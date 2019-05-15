import { isAction, action, runInAction } from "mobx"
import { addHiddenProp } from "./utils"

let actionProtection = true

export function getActionProtection() {
  return actionProtection
}
export function runUnprotected<T>(name: string, fn: () => T): T
export function runUnprotected<T>(fn: () => T): T
export function runUnprotected<T>(arg1: any, arg2?: any): T {
  const name = typeof arg1 === "string" ? arg1 : undefined
  const fn: () => T = typeof arg1 === "string" ? arg2 : arg1

  const oldActionProtection = actionProtection
  actionProtection = false
  try {
    if (name) {
      return runInAction(name, fn)
    } else {
      return runInAction(fn)
    }
  } finally {
    actionProtection = oldActionProtection
  }
}

export interface ActionContext {
  readonly name: string
  readonly target: object
  readonly args: readonly any[]
  readonly parentContext?: ActionContext
  readonly data: unknown
}

let currentActionContext: ActionContext | undefined

export function getCurrentActionContext() {
  return currentActionContext
}

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
      parentContext: currentActionContext,
      data: {},
    }

    currentActionContext = context

    let mwareFn: () => any = fn.bind(this, ...arguments)
    actionMiddlewares.forEach(mware => {
      const filterPassed = mware.filter ? mware.filter(context) : true
      if (filterPassed) {
        mwareFn = mware.fn.bind(undefined, context, mwareFn)
      }
    })

    try {
      return mwareFn()
    } finally {
      currentActionContext = context.parentContext
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

export type ActionMiddleware = (ctx: ActionContext, next: () => any) => any
export type ActionMiddlewareDisposer = () => void
export type ActionMiddlewareFilter = (ctx: ActionContext) => boolean

const actionMiddlewares: { fn: ActionMiddleware; filter?: ActionMiddlewareFilter }[] = []

export function addActionMiddleware(
  mware: ActionMiddleware,
  filter?: ActionMiddlewareFilter
): ActionMiddlewareDisposer {
  if (typeof mware !== "function") {
    throw fail("a middleware must be a function")
  }

  if (actionMiddlewares.findIndex(m => m.fn === mware) >= 0) {
    throw fail("middleware already present")
  }

  actionMiddlewares.push({ fn: mware, filter })
  return () => {
    const index = actionMiddlewares.findIndex(m => m.fn === mware)
    actionMiddlewares.splice(index, 1)
  }
}
