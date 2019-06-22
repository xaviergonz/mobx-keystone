import {
  ActionContext,
  ActionContextActionType,
  ActionContextAsyncStepType,
} from "../action/context"
import {
  ActionMiddleware,
  ActionMiddlewareDisposer,
  addActionMiddleware,
} from "../action/middleware"
import { FlowFinisher } from "../action/modelFlow"
import { AnyModel } from "../model/Model"
import { assertIsModel } from "../model/utils"
import { assertIsObject, failure } from "../utils"

/**
 * Simplified version of action context.
 */
export interface SimpleActionContext {
  /**
   * Action name
   */
  readonly actionName: string
  /**
   * Action type, sync or async.
   */
  readonly type: ActionContextActionType
  /**
   * Action target object.
   */
  readonly target: AnyModel
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
  /**
   * The action returned normally (without throwing).
   */
  Return = "return",
  /**
   * The action threw an error.
   */
  Throw = "throw",
}

/**
 * Action tracking middleware hooks.
 */
export interface ActionTrackingMiddleware {
  /**
   * Filter function called before each action starts.
   * If the action is accepted then `onStart`, `onResume`, `onSuspend` and `onFinish`
   * for that particular action will be called.
   * All actions are accepted by default if no filter function is present.
   *
   * @param ctx Simplified action context.
   * @returns true to accept the action, false to skip it.
   */
  filter?(ctx: SimpleActionContext): boolean

  /**
   * An action just started.
   *
   * @param ctx Simplified action context.
   */
  onStart?(ctx: SimpleActionContext): void

  /**
   * An action just resumed a synchronous piece of code execution.
   *
   * @param ctx Simplified action context.
   */
  onResume?(ctx: SimpleActionContext): void

  /**
   * An action just finished a synchronous pice of code execution.
   * Note that this doesn't necessarily mean the action is finished.
   *
   * @param ctx Simplified action context.
   */
  onSuspend?(ctx: SimpleActionContext): void

  /**
   * The action just finished, either by returning normally or by throwing an error.
   *
   * @param ctx Simplified action context.
   * @param result If the action finished normally or due to a thrown error.
   * @param value The return value / error thrown.
   * @param overrideValue Use this method to override the returned value / error thrown.
   */
  onFinish?(
    ctx: SimpleActionContext,
    result: ActionTrackingResult,
    value: any,
    overrideValue: (newValue: any) => void
  ): void
}

/**
 * Creates an action tracking middleware, which is a simplified version
 * of the standard action middleware.
 * Note that `filter` is only called for the start of the actions. If the
 * action is accepted then `onStart`, `onResume`, `onSuspend` and `onFinish`
 * for that particular action will be called.
 *
 * @typeparam M Model
 * @param target Object with root target model object (`model`). If an `actionName` is provided then
 * the tracking middleware will only be called for that particular action and its sub-actions.
 * @param hooks Middleware hooks.
 * @returns The middleware disposer.
 */
export function actionTrackingMiddleware<M extends AnyModel>(
  target: {
    model: M
    actionName?: keyof M
  },
  hooks: ActionTrackingMiddleware
): ActionMiddlewareDisposer {
  assertIsObject(target, "target")

  const { model, actionName } = target

  assertIsModel(model, "target.model")

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
      if (ctx.rootContext.target !== model || ctx.rootContext.actionName !== actionName) {
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

  const start: ActionTrackingMiddleware["onStart"] = simpleCtx => {
    setCtxData(simpleCtx, {
      state: "started",
    })
    if (hooks.onStart) {
      hooks.onStart(simpleCtx)
    }
  }

  const finish: ActionTrackingMiddleware["onFinish"] = (
    simpleCtx,
    result,
    value,
    overrideValue
  ) => {
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
    if (hooks.onFinish) {
      hooks.onFinish(simpleCtx, result, value, overrideValue)
    }

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
        finish(simpleCtx, ActionTrackingResult.Throw, err, newValue => {
          err = newValue
        })
        throw err
      }

      finish(simpleCtx, ActionTrackingResult.Return, ret, newValue => {
        ret = newValue
      })
      return ret
    } else {
      // async

      switch (ctx.asyncStepType) {
        case ActionContextAsyncStepType.Spawn: {
          start(simpleCtx)
          return next()
        }

        case ActionContextAsyncStepType.Return: {
          const ret: FlowFinisher = next()
          finish(simpleCtx, ActionTrackingResult.Return, ret.value, newValue => {
            ret.value = newValue
          })
          return ret
        }

        case ActionContextAsyncStepType.Throw: {
          const ret: FlowFinisher = next()
          finish(simpleCtx, ActionTrackingResult.Throw, ret.value, newValue => {
            ret.value = newValue
          })
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

  return addActionMiddleware({ middleware: mware, filter, target: model })
}

const simpleDataContextSymbol = Symbol("simpleDataContext")

/**
 * Simplifies an action context by converting an async call hierarchy into a simpler one.
 *
 * @param ctx Action context to convert.
 * @returns Simplified action context.
 */
export function simplifyActionContext(ctx: ActionContext): SimpleActionContext {
  while (ctx.previousAsyncStepContext) {
    ctx = ctx.previousAsyncStepContext
  }

  let simpleCtx = ctx.data[simpleDataContextSymbol]
  if (!simpleCtx) {
    const parentContext = ctx.parentContext ? simplifyActionContext(ctx.parentContext) : undefined

    simpleCtx = {
      actionName: ctx.actionName,
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
