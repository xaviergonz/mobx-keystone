import {
  ActionContext,
  ActionContextActionType,
  ActionContextAsyncStepType,
} from "../action/context"
import { ActionMiddleware } from "../action/middleware"
import { Model } from "../model/Model"
import { assertIsObject, failure } from "../utils"

/**
 * Simplified version of action context.
 */
export interface SimpleActionContext {
  /**
   * Action name
   */
  readonly name: string
  /**
   * Action type, sync or async.
   */
  readonly type: ActionContextActionType
  /**
   * Action target object.
   */
  readonly target: Model
  /**
   * Array of action arguments.
   */
  readonly args: readonly any[]
  /**
   * Parent action context.
   */
  readonly parentContext?: SimpleActionContext
  /**
   * Root action context.
   */
  readonly rootContext: SimpleActionContext
  /**
   * Custom data for the action context to be set by middlewares, an object.
   */
  readonly data: any
}

/**
 * Action tracking middleware finish result.
 */
export enum ActionTrackingResult {
  Return = "return",
  Throw = "throw",
}

/**
 * Action tracking middleware hooks.
 */
export interface ActionTrackingMiddleware {
  filter?(ctx: SimpleActionContext): boolean
  onStart(ctx: SimpleActionContext): void
  onResume?(ctx: SimpleActionContext): void
  onSuspend?(ctx: SimpleActionContext): void
  onFinish(ctx: SimpleActionContext, result: ActionTrackingResult, value: any): void
}

/**
 * Creates an action tracking middleware, which is a simplified version
 * of the standard action middleware.
 * Note that `filter` is only called for the start of the actions. If the
 * action is accepted then `onStart`, `onResume`, `onSuspend` and `onFinish`
 * for that particular action will be called.
 *
 * @typeparam M Model
 * @param target Root target model object. If an `actionName` is provided then
 * the tracking middleware will only be called for that particular action and its sub-actions.
 * @param hooks Middleware hooks.
 * @returns The actual middleware to pass to `addActionMiddleware`.
 */
export function actionTrackingMiddleware<M extends Model>(
  target: {
    model: M
    actionName?: keyof M
  },
  hooks: ActionTrackingMiddleware
): ActionMiddleware {
  assertIsObject(target, "target")

  const { model, actionName } = target

  if (!(model instanceof Model)) {
    throw failure("target.model must be a model")
  }

  if (actionName && typeof actionName !== "string") {
    throw failure("target.actionName must be a string or undefined")
  }

  const dataSymbol = Symbol("actionTrackingMiddlewareData")
  interface Data {
    startAccepted: boolean
    state: "idle" | "started" | "realResumed" | "fakeResumed" | "suspended" | "finished"
  }
  function getCtxData(ctx: ActionContext | SimpleActionContext): Data | undefined {
    return ctx.data[dataSymbol]
  }
  function setCtxData(ctx: ActionContext | SimpleActionContext, partialData: Partial<Data>) {
    let currentData = ctx.data[dataSymbol]
    if (!currentData) {
      ctx.data[dataSymbol] = partialData
    } else {
      Object.assign(currentData, partialData)
    }
  }

  const userFilter: ActionMiddleware["filter"] = ctx => {
    if (hooks.filter) {
      return hooks.filter(simplifyActionContext(ctx))
    }

    return true
  }

  const resumeSuspendSupport = !!hooks.onResume || !!hooks.onSuspend

  const filter: ActionMiddleware["filter"] = ctx => {
    // if we are given an action name ensure it is the root action
    if (actionName) {
      if (ctx.rootContext.target !== model || ctx.rootContext.name !== actionName) {
        return false
      }
    }

    if (ctx.type === ActionContextActionType.Sync) {
      // start and finish is on the same context
      const accepted = userFilter(ctx)
      if (accepted) {
        setCtxData(ctx, {
          startAccepted: true,
          state: "idle",
        })
      }
      return accepted
    } else {
      switch (ctx.asyncStepType) {
        case ActionContextAsyncStepType.Spawn:
          const accepted = userFilter(ctx)
          if (accepted) {
            setCtxData(ctx, {
              startAccepted: true,
              state: "idle",
            })
          }
          return accepted

        case ActionContextAsyncStepType.Return:
        case ActionContextAsyncStepType.Throw:
          // depends if the spawn one was accepted or not
          let previousCtx = ctx
          while (previousCtx.previousAsyncStepContext) {
            previousCtx = previousCtx.previousAsyncStepContext!
          }
          const data = getCtxData(previousCtx)
          return data ? data.startAccepted : false

        case ActionContextAsyncStepType.Resume:
        case ActionContextAsyncStepType.ResumeError:
          return resumeSuspendSupport

        default:
          return false
      }
    }
  }

  const start = (simpleCtx: SimpleActionContext) => {
    setCtxData(simpleCtx, {
      state: "started",
    })
    hooks.onStart(simpleCtx)
  }

  const finish = (simpleCtx: SimpleActionContext, result: ActionTrackingResult, value: any) => {
    // fakely resume and suspend the parent if needed
    const parentCtx = simpleCtx.parentContext
    let parentResumed = false
    if (parentCtx) {
      const parentData = getCtxData(parentCtx)
      if (parentData && parentData.startAccepted && parentData.state === "suspended") {
        parentResumed = true
        resume(parentCtx, false)
      }
    }

    setCtxData(simpleCtx, {
      state: "finished",
    })
    hooks.onFinish(simpleCtx, result, value)

    if (parentResumed) {
      suspend(parentCtx!)
    }
  }

  const resume = (simpleCtx: SimpleActionContext, real: boolean) => {
    // ensure parents are resumed
    const parentCtx = simpleCtx.parentContext
    if (parentCtx) {
      const parentData = getCtxData(parentCtx)
      if (parentData && parentData.startAccepted && parentData.state === "suspended") {
        resume(parentCtx, false)
      }
    }

    setCtxData(simpleCtx, {
      state: real ? "realResumed" : "fakeResumed",
    })
    if (hooks.onResume) {
      hooks.onResume(simpleCtx)
    }
  }

  const suspend = (simpleCtx: SimpleActionContext) => {
    setCtxData(simpleCtx, {
      state: "suspended",
    })
    if (hooks.onSuspend) {
      hooks.onSuspend(simpleCtx)
    }

    // ensure parents are suspended if they were fakely resumed
    const parentCtx = simpleCtx.parentContext
    if (parentCtx) {
      const parentData = getCtxData(parentCtx)
      if (parentData && parentData.startAccepted && parentData.state === "fakeResumed") {
        suspend(parentCtx)
      }
    }
  }

  const mware: ActionMiddleware["middleware"] = (ctx, next) => {
    const simpleCtx = simplifyActionContext(ctx)

    const origNext = next
    next = () => {
      resume(simpleCtx, true)
      try {
        return origNext()
      } finally {
        suspend(simpleCtx)
      }
    }

    if (ctx.type === ActionContextActionType.Sync) {
      start(simpleCtx)

      let ret
      try {
        ret = next()
      } catch (err) {
        finish(simpleCtx, ActionTrackingResult.Throw, err)
        throw err
      }

      finish(simpleCtx, ActionTrackingResult.Return, ret)
      return ret
    } else {
      // async

      switch (ctx.asyncStepType) {
        case ActionContextAsyncStepType.Spawn: {
          start(simpleCtx)
          return next()
        }

        case ActionContextAsyncStepType.Return: {
          const ret = next()
          finish(simpleCtx, ActionTrackingResult.Return, ret)
          return ret
        }

        case ActionContextAsyncStepType.Throw: {
          const ret = next()
          finish(simpleCtx, ActionTrackingResult.Throw, ret)
          return ret
        }

        case ActionContextAsyncStepType.Resume:
        case ActionContextAsyncStepType.ResumeError:
          if (resumeSuspendSupport) {
            return next()
          } else {
            throw failure(
              `asssertion error: async step should have been filtered out - ${ctx.asyncStepType}`
            )
          }

        default:
          throw failure(
            `asssertion error: async step should have been filtered out - ${ctx.asyncStepType}`
          )
      }
    }
  }

  return { middleware: mware, filter, target: model }
}

const simpleDataContextSymbol = Symbol("simpleDataContext")

/**
 * Simplifies an action context by turning an async call hierarchy into a simpler one.
 *
 * @param ctx
 * @returns
 */
export function simplifyActionContext(ctx: ActionContext): SimpleActionContext {
  while (ctx.previousAsyncStepContext) {
    ctx = ctx.previousAsyncStepContext
  }

  let simpleCtx = ctx.data[simpleDataContextSymbol]
  if (!simpleCtx) {
    const parentContext = ctx.parentContext ? simplifyActionContext(ctx.parentContext) : undefined

    simpleCtx = {
      name: ctx.name,
      type: ctx.type,
      target: ctx.target,
      args: ctx.args,
      data: ctx.data,
      parentContext,
    }
    simpleCtx.rootContext = parentContext ? parentContext.rootContext : simpleCtx

    ctx.data[simpleDataContextSymbol] = simpleCtx
  }
  return simpleCtx
}
