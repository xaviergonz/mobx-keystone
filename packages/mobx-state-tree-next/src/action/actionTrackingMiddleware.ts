import { Model } from "../model"
import { isChildOfParent } from "../parent"
import { failure } from "../utils"
import { ActionContext, ActionContextActionType, ActionContextAsyncStepType } from "./context"
import { ActionMiddleware, ActionMiddlewareFilter, addActionMiddleware } from "./middleware"

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
  readonly target: object
  /**
   * Array of action arguments.
   */
  readonly args: readonly any[]
  /**
   * Parent action context.
   */
  readonly parentContext?: SimpleActionContext
  /**
   * Custom data for the action context to be set by middlewares, an object.
   */
  readonly data: unknown
}

/**
 * The disposer of an action tracking middleware.
 */
export type ActionTrackingMiddlewareDisposer = () => void

/**
 * Action tracking middleware finish result.
 */
export enum ActionTrackingMiddlewareResult {
  Return = "return",
  Throw = "throw",
}

/**
 * Action tracking middleware hooks.
 */
export interface ActionTrackingMiddleware {
  filter?(ctx: SimpleActionContext): boolean
  onStart(ctx: SimpleActionContext): void
  onFinish(ctx: SimpleActionContext, result: ActionTrackingMiddlewareResult, value: any): void
}

/**
 * Attaches an action tracking middleware, which is a simplified version
 * of the standard action middleware.
 *
 * @param target Root target model object.
 * @param hooks Middleware hooks.
 * @returns A disposer to cancel the middleware.
 */
export function addActionTrackingMiddleware(
  target: Model,
  hooks: ActionTrackingMiddleware
): ActionTrackingMiddlewareDisposer {
  const basicFilter: ActionMiddlewareFilter = ctx => {
    if (ctx.target !== target && !isChildOfParent(ctx.target, target)) {
      return false
    }

    if (ctx.type === ActionContextActionType.Sync) {
      return true
    } else {
      switch (ctx.asyncStepType) {
        case ActionContextAsyncStepType.Spawn:
        case ActionContextAsyncStepType.Return:
        case ActionContextAsyncStepType.Throw:
          return true
        default:
          return false
      }
    }
  }

  const filter: ActionMiddlewareFilter = ctx => {
    if (!basicFilter(ctx)) {
      return false
    }

    if (hooks.filter) {
      return hooks.filter(simplifyActionContext(ctx))
    }

    return true
  }

  const mware: ActionMiddleware = (ctx, next) => {
    const simpleCtx = simplifyActionContext(ctx)

    if (ctx.type === ActionContextActionType.Sync) {
      hooks.onStart(simpleCtx)

      let ret
      try {
        ret = next()
      } catch (err) {
        hooks.onFinish(simpleCtx, ActionTrackingMiddlewareResult.Throw, err)
        throw err
      }

      hooks.onFinish(simpleCtx, ActionTrackingMiddlewareResult.Return, ret)
      return ret
    } else {
      // async

      if (ctx.asyncStepType === ActionContextAsyncStepType.Spawn) {
        hooks.onStart(simpleCtx)
        return next()
      } else if (ctx.asyncStepType === ActionContextAsyncStepType.Return) {
        const ret = next()
        hooks.onFinish(simpleCtx, ActionTrackingMiddlewareResult.Return, ret)
        return ret
      } else if (ctx.asyncStepType === ActionContextAsyncStepType.Throw) {
        const ret = next()
        hooks.onFinish(simpleCtx, ActionTrackingMiddlewareResult.Throw, ret)
        return ret
      } else {
        throw failure(
          `asssertion error: async step should have been filtered out - ${ctx.asyncStepType}`
        )
      }
    }
  }

  return addActionMiddleware(mware, filter)
}

/**
 * Simplifies an action context by turning an async call hierarchy into a similar sync one.
 *
 * @param ctx
 * @returns
 */
export function simplifyActionContext(ctx: ActionContext): SimpleActionContext {
  while (ctx.previousAsyncStepContext) {
    ctx = ctx.previousAsyncStepContext
  }

  return {
    name: ctx.name,
    type: ctx.type,
    target: ctx.target,
    args: ctx.args,
    data: ctx.data,
    parentContext: ctx.parentContext ? simplifyActionContext(ctx.parentContext) : undefined,
  }
}
