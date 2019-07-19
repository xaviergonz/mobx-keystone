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
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

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
   * Action target model instance.
   */
  readonly target: AnyModel
  /**
   * Array of action arguments.
   */
  readonly args: ReadonlyArray<any>
  /**
   * Parent action context, if any.
   */
  readonly parentContext?: SimpleActionContext
  /**
   * Root action context, or itself if the root.
   */
  readonly rootContext: SimpleActionContext
  /**
   * Custom data for the action context to be set by middlewares, an object.
   * It is advised to use symbols as keys whenever possible to avoid name
   * clashing between middlewares.
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
   * Filter function called whenever each action starts, and only then.
   *
   * If the action is accepted then `onStart`, `onResume`, `onSuspend` and `onFinish`
   * for that particular action will be called.
   *
   * All actions are accepted by default if no filter function is present.
   *
   * @param ctx Simplified action context.
   * @returns true to accept the action, false to skip it.
   */
  filter?(ctx: SimpleActionContext): boolean

  /**
   * Called when an action just started.
   *
   * @param ctx Simplified action context.
   * @returns Can optionally return a result that will cancel the original action and finish it
   * with the returned value / error to be thrown. In either case case resume / suspend / finish will
   * still be called normally.
   */
  onStart?(ctx: SimpleActionContext): void | ActionTrackingReturn

  /**
   * Called when an action just resumed a synchronous piece of code execution.
   * Gets called once for sync actions and multiple times for flows.
   *
   * @param ctx Simplified action context.
   */
  onResume?(ctx: SimpleActionContext): void

  /**
   * Called when an action just finished a synchronous pice of code execution.
   * Note that this doesn't necessarily mean the action is finished.
   * Gets called once for sync actions and multiple times for flows.
   *
   * @param ctx Simplified action context.
   */
  onSuspend?(ctx: SimpleActionContext): void

  /**
   * Called when an action just finished, either by returning normally or by throwing an error.
   *
   * @param ctx Simplified action context.
   * @param ret Action return result.
   * @returns Can optionally return a new result that will override the original one.
   */
  onFinish?(ctx: SimpleActionContext, ret: ActionTrackingReturn): void | ActionTrackingReturn
}

/**
 * Return result of an action.
 */
export interface ActionTrackingReturn {
  result: ActionTrackingResult
  value: any
}

/**
 * Creates an action tracking middleware, which is a simplified version
 * of the standard action middleware.
 *
 * @param target Root target model object.
 * @param hooks Middleware hooks.
 * @returns The middleware disposer.
 */
export function actionTrackingMiddleware(
  target: object,
  hooks: ActionTrackingMiddleware
): ActionMiddlewareDisposer {
  assertTweakedObject(target, "target")

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
          const data = getCtxData(ctx.spawnAsyncStepContext!)
          return data ? data.startAccepted : false

        case ActionContextAsyncStepType.Resume:
        case ActionContextAsyncStepType.ResumeError:
          if (!resumeSuspendSupport) {
            return false
          } else {
            // depends if the spawn one was accepted or not
            const data = getCtxData(ctx.spawnAsyncStepContext!)
            return data ? data.startAccepted : false
          }

        default:
          return false
      }
    }
  }

  const start = (simpleCtx: SimpleActionContext): ActionTrackingReturn | undefined => {
    setCtxData(simpleCtx, {
      state: "started",
    })
    if (hooks.onStart) {
      return hooks.onStart(simpleCtx) || undefined
    }
    return undefined
  }

  const finish = (
    simpleCtx: SimpleActionContext,
    ret: ActionTrackingReturn
  ): ActionTrackingReturn => {
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
      ret = hooks.onFinish(simpleCtx, ret) || ret
    }

    if (parentResumed) {
      suspend(parentCtx!)
    }

    return ret
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
      let retObj = start(simpleCtx)

      if (retObj) {
        // action cancelled / overriden by onStart
        resume(simpleCtx, true)
        suspend(simpleCtx)
        retObj = finish(simpleCtx, retObj)
      } else {
        try {
          retObj = finish(simpleCtx, { result: ActionTrackingResult.Return, value: next() })
        } catch (err) {
          retObj = finish(simpleCtx, { result: ActionTrackingResult.Throw, value: err })
        }
      }

      return returnOrThrowActionTrackingReturn(retObj)
    } else {
      // async

      switch (ctx.asyncStepType) {
        case ActionContextAsyncStepType.Spawn: {
          let retObj = start(simpleCtx)
          if (retObj) {
            // action cancelled / overriden by onStart
            resume(simpleCtx, true)
            suspend(simpleCtx)
            retObj = finish(simpleCtx, retObj)
            return returnOrThrowActionTrackingReturn(retObj)
          } else {
            return next()
          }
        }

        case ActionContextAsyncStepType.Return: {
          const flowFinisher: FlowFinisher = next()
          const retObj = finish(simpleCtx, {
            result: ActionTrackingResult.Return,
            value: flowFinisher.value,
          })
          flowFinisher.resolution =
            retObj.result === ActionTrackingResult.Return ? "accept" : "reject"
          flowFinisher.value = retObj.value
          return flowFinisher
        }

        case ActionContextAsyncStepType.Throw: {
          const flowFinisher: FlowFinisher = next()
          const retObj = finish(simpleCtx, {
            result: ActionTrackingResult.Throw,
            value: flowFinisher.value,
          })
          flowFinisher.resolution =
            retObj.result === ActionTrackingResult.Return ? "accept" : "reject"
          flowFinisher.value = retObj.value
          return flowFinisher
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

  return addActionMiddleware({ middleware: mware, filter, target })
}

function returnOrThrowActionTrackingReturn(retObj: ActionTrackingReturn) {
  if (retObj.result === ActionTrackingResult.Return) {
    return retObj.value
  } else {
    throw retObj.value
  }
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
