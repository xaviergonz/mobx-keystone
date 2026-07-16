import { action } from "mobx"
import type { O } from "ts-toolbelt"
import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import { fastGetParent } from "../parent/path"
import type { AnyFunction } from "../utils/AnyFunction"
import { copyFunctionMetadata } from "../utils/decorators"
import {
  type ActionContext,
  ActionContextActionType,
  getCurrentActionContext,
  setCurrentActionContext,
} from "./context"
import { isModelAction, modelActionSymbol } from "./isModelAction"
import { getPerObjectActionMiddlewares } from "./middleware"
import type { FlowFinisher } from "./modelFlow"
import { finishMutationBatch, startMutationBatch } from "./mutationBatch"
import { tryRunPendingActions } from "./pendingActions"

function isActionTargetInSubtree(target: object, subtreeRoot: object): boolean {
  let current: object | undefined = target
  while (current) {
    if (current === subtreeRoot) {
      return true
    }
    current = fastGetParent(current, false)
  }
  return false
}

/**
 * @internal
 */
export type WrapInActionOverrideContextFn = (ctx: O.Writable<ActionContext>, self: AnyModel) => void

/**
 * @internal
 */
export function wrapInAction<T extends Function>({
  nameOrNameFn,
  fn,
  actionType,
  overrideContext,
  isFlowFinisher = false,
}: {
  nameOrNameFn: string | (() => string)
  fn: T
  actionType: ActionContextActionType
  overrideContext?: WrapInActionOverrideContextFn
  isFlowFinisher?: boolean
}): T {
  let fnInAction = false

  const wrappedAction = function (this: AnyModel, ...args: unknown[]) {
    const name = typeof nameOrNameFn === "function" ? nameOrNameFn() : nameOrNameFn

    if (!fnInAction) {
      fnInAction = true

      // we need to make only inner actions actual mobx actions
      // so reactions (e.g. reference detaching) are picked up in the
      // right context
      fn = action(name, fn)
    }

    const parentContext = getCurrentActionContext()

    const context: O.Writable<ActionContext> = {
      actionName: name,
      type: actionType,
      target: this,
      args,
      parentContext,
      data: {},
      rootContext: undefined as never, // will be set after the override
    }
    if (overrideContext) {
      overrideContext(context, this)
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

    const perObjectMiddlewares = getPerObjectActionMiddlewares(context.target)
    let objectIndex = perObjectMiddlewares.length - 1 // from topmost parent to the object itself
    let objectMwareIndex = 0
    let scopeMayHaveChanged = false

    const runNextMiddleware = (): unknown => {
      while (objectIndex >= 0) {
        const objectMwares = perObjectMiddlewares[objectIndex]
        const mwareData = objectMwares[objectMwareIndex]

        // Advance before calling user code so next() continues with the following middleware.
        objectMwareIndex++
        if (objectMwareIndex >= objectMwares.length) {
          objectMwareIndex = 0
          objectIndex--
        }

        if (
          scopeMayHaveChanged &&
          !isActionTargetInSubtree(context.target, mwareData.subtreeRoot)
        ) {
          continue
        }

        if (mwareData.filter) {
          scopeMayHaveChanged = true
          if (!mwareData.filter(context)) {
            continue
          }
        }

        scopeMayHaveChanged = true
        return mwareData.middleware(context, runNextMiddleware)
      }

      return fn.apply(this, args)
    }

    const mutationBatchOwner = startMutationBatch()
    try {
      const ret = runNextMiddleware()

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
      if (mutationBatchOwner) {
        finishMutationBatch()
      }
      tryRunPendingActions()
    }
  }
  ;(wrappedAction as unknown as { [modelActionSymbol]: true })[modelActionSymbol] = true

  copyFunctionMetadata(fn, wrappedAction)

  return wrappedAction as unknown as T
}

/**
 * @internal
 */
export function wrapModelMethodInActionIfNeeded<M extends AnyModel | AnyDataModel>(
  model: M,
  propertyKey: keyof M,
  name: string
): void {
  const fn = model[propertyKey] as AnyFunction
  if (isModelAction(fn)) {
    return
  }

  const wrappedFn = wrapInAction({
    nameOrNameFn: name,
    fn,
    actionType: ActionContextActionType.Sync,
  })
  const proto = Object.getPrototypeOf(model)
  const protoFn = proto[propertyKey]
  if (protoFn === fn) {
    proto[propertyKey] = wrappedFn
  } else {
    model[propertyKey] = wrappedFn as M[typeof propertyKey]
  }
}
