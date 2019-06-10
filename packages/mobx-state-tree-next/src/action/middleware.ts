import { action, isAction } from "mobx"
import { Model } from "../model"
import { isChildOfParent } from "../parent/path"
import { failure, isObject } from "../utils"
import { ActionContext } from "./context"

/**
 * An action middleware.
 */
export interface ActionMiddleware {
  /**
   * Subtree (object and child objects) this middleware will run for, or undefined for any object.
   * This target 'filter' will be run before the custom filter.
   */
  target?: Model

  /**
   * A filter function to decide if an action middleware function should be run or not.
   */
  filter?(ctx: ActionContext): boolean

  /**
   * An action middleware function.
   * Rember to `return next()` if you want to continue the action or throw if you want to cancel it.
   */
  middleware(ctx: ActionContext, next: () => any): any
}

/**
 * The disposer of an action middleware.
 */
export type ActionMiddlewareDisposer = () => void

const actionMiddlewares: ActionMiddleware[] = []

/**
 * @ignore
 *
 * Gets the current action middlewares.
 *
 * @returns
 */
export function getActionMiddlewares() {
  return actionMiddlewares
}

/**
 * Adds a global action middleware to be run when an action is performed.
 * It is usually preferable to use `onAction` instead to limit it to a given tree and only to topmost level actions
 * or `actionTrackingMiddleware` for a simplified middleware.
 *
 * @param mware Action middleware to be run.
 * @returns
 */
export function addActionMiddleware(mware: ActionMiddleware): ActionMiddlewareDisposer {
  if (!isObject(mware)) {
    throw failure("middleware must be an object")
  }

  let { middleware, filter, target } = mware

  if (typeof middleware !== "function") {
    throw failure("middleware.middleware must be a function")
  }
  if (filter && typeof filter !== "function") {
    throw failure("middleware.filter must be a function if present")
  }

  if (!isAction(middleware)) {
    middleware = action(middleware.name || "actionMiddleware", middleware)
  }

  if (target) {
    const targetFilter = (ctx: ActionContext) =>
      ctx.target === target || isChildOfParent(ctx.target, target!)
    if (!filter) {
      filter = targetFilter
    } else {
      const customFilter = filter
      filter = ctx => targetFilter(ctx) && customFilter(ctx)
    }
  }

  actionMiddlewares.push({ middleware, filter })
  return () => {
    const index = actionMiddlewares.findIndex(m => m.middleware === middleware)
    actionMiddlewares.splice(index, 1)
  }
}
