import { action } from "mobx"
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
import { tryRunPendingActions } from "./pendingActions"

/**
 * @ignore
 */
export const modelActionSymbol = Symbol("modelAction")

/**
 * @ignore
 */
export function wrapInAction<T extends Function>({
  name,
  fn,
  actionType,
  overrideContext,
  isFlowFinisher = false,
}: {
  name: string
  fn: T
  actionType: ActionContextActionType
  overrideContext?: (ctx: O.Writable<ActionContext>) => void
  isFlowFinisher?: boolean
}): T {
  // we need to make only inner actions actual mobx actions
  // so reactions (e.g. reference detaching) are picked up in the
  // right context
  fn = action(name, fn)

  const wrappedAction = function (this: any) {
    const target = this

    if (inDevMode()) {
      assertTweakedObject(target, "wrappedAction")
    }

    const parentContext = getCurrentActionContext()

    const context: O.Writable<ActionContext> = {
      actionName: name,
      type: actionType,
      target,
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

    let mwareFn: () => any = fn.bind(target, ...arguments)
    const mwareIter = getActionMiddlewares(target)[Symbol.iterator]()
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

      if (isFlowFinisher) {
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

      tryRunPendingActions()
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

  const wrappedFn = wrapInAction({ name, fn, actionType: ActionContextActionType.Sync })
  const proto = Object.getPrototypeOf(model)
  const protoFn = proto[propertyKey]
  if (protoFn === fn) {
    proto[propertyKey] = wrappedFn
  } else {
    model[propertyKey] = wrappedFn
  }
}
