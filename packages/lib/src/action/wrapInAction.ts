import { action, isAction } from "mobx"
import { O } from "ts-toolbelt"
import { AnyModel } from "../model/BaseModel"
import { assertTweakedObject } from "../tweaker/core"
import { inDevMode } from "../utils"
import {
  ActionContext,
  ActionContextActionType,
  getCurrentActionContext,
  setCurrentActionContext,
} from "./context"
import { getActionMiddlewares } from "./middleware"
import { isModelAction } from "./modelAction"
import { FlowFinisher } from "./modelFlow"

/**
 * @ignore
 */
export const modelActionSymbol = Symbol("modelAction")

/**
 * @ignore
 */
export function wrapInAction<T extends Function>(
  name: string,
  fn: T,
  actionType: ActionContextActionType,
  overrideContext?: (ctx: O.Writable<ActionContext>) => void,
  isFlowFinsher = false
): T {
  if (!isAction(fn)) {
    fn = action(name, fn)
  }

  function wrappedAction(this: any) {
    if (inDevMode()) {
      assertTweakedObject(this, "wrappedAction")
    }

    const parentContext = getCurrentActionContext()

    const context: O.Writable<ActionContext> = {
      actionName: name,
      type: actionType,
      target: this,
      args: Array.from(arguments),
      parentContext,
      data: {},
      rootContext: undefined as any, // will be set after the override
    }
    if (overrideContext) {
      overrideContext(context)
    }
    if (!context.rootContext) {
      if (context.previousAsyncStepContext) {
        context.rootContext = context.previousAsyncStepContext.rootContext
      } else if (context.parentContext) {
        context.rootContext = context.parentContext.rootContext
      } else {
        context.rootContext = context
      }
    }

    setCurrentActionContext(context)

    let mwareFn: () => any = fn.bind(this, ...arguments)
    const mwareIter = getActionMiddlewares(this)[Symbol.iterator]()
    let mwareCur = mwareIter.next()
    while (!mwareCur.done) {
      const mware = mwareCur.value

      const filterPassed = mware.filter ? mware.filter(context) : true
      if (filterPassed) {
        mwareFn = mware.middleware.bind(undefined, context, mwareFn)
      }

      mwareCur = mwareIter.next()
    }

    try {
      const ret = mwareFn()

      if (isFlowFinsher) {
        const flowFinisher = ret as FlowFinisher
        const value = flowFinisher.value
        if (flowFinisher.resolution === "accept") {
          flowFinisher.accepter(value)
        } else {
          flowFinisher.rejecter(value)
        }
        return value // not sure if this is even needed
      } else {
        return ret
      }
    } finally {
      setCurrentActionContext(context.parentContext)
    }
  }
  ;(wrappedAction as any)[modelActionSymbol] = true

  return wrappedAction as any
}

/**
 * @ignore
 */
export function wrapModelMethodInActionIfNeeded<M extends AnyModel>(
  model: M,
  propertyKey: keyof M,
  name: string
): void {
  const fn = model[propertyKey] as any
  if (isModelAction(fn)) {
    return
  }

  const wrappedFn = wrapInAction(name, fn, ActionContextActionType.Sync)
  const proto = Object.getPrototypeOf(model)
  const protoFn = proto[propertyKey]
  if (protoFn === fn) {
    proto[propertyKey] = wrappedFn
  } else {
    model[propertyKey] = wrappedFn
  }
}
