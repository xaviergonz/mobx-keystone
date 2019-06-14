import { action, isAction } from "mobx"
import { Writable } from "ts-essentials"
import { assertTweakedObject } from "../tweaker/core"
import { inDevMode } from "../utils"
import {
  ActionContext,
  ActionContextActionType,
  getCurrentActionContext,
  setCurrentActionContext,
} from "./context"
import { getActionMiddlewares } from "./middleware"

export const modelActionSymbol = Symbol("modelAction")

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
    if (inDevMode()) {
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
