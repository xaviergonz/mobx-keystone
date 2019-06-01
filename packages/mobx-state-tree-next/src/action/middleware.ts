import { action, isAction } from "mobx"
import { failure } from "../utils"
import { ActionContext } from "./context"

/**
 * An action middleware function.
 * Rember to `return next()` if you want to continue the action or throw if you want to cancel it.
 */
export type ActionMiddleware = (ctx: ActionContext, next: () => any) => any

/**
 * The disposer of an action middleware.
 */
export type ActionMiddlewareDisposer = () => void

/**
 * A filter function to decide if an action middleware function should be run or not.
 */
export type ActionMiddlewareFilter = (ctx: ActionContext) => boolean

const actionMiddlewares: { fn: ActionMiddleware; filter?: ActionMiddlewareFilter }[] = []

export function getActionMiddlewares() {
  return actionMiddlewares
}

/**
 * Adds a global action middleware to be run when an action is performed.
 * It is usually preferable to use `onAction` instead to limit it to a given tree and only to topmost level actions.
 *
 * @export
 * @param mware Action middleware function to be run.
 * @param [filter] A filter function to decide if this action middleware function should be run or not.
 * @returns
 */
export function addActionMiddleware(
  mware: ActionMiddleware,
  filter?: ActionMiddlewareFilter
): ActionMiddlewareDisposer {
  if (typeof mware !== "function") {
    throw failure("a middleware must be a function")
  }
  if (filter && typeof filter !== "function") {
    throw failure("a filter must be a function")
  }

  mware = !isAction(mware) ? action(mware.name || "actionMiddleware", mware) : mware
  if (filter) {
    filter = !isAction(filter) ? action(filter.name || "actionMiddlewareFilter", filter) : filter
  }

  actionMiddlewares.push({ fn: mware, filter })
  return () => {
    const index = actionMiddlewares.findIndex(m => m.fn === mware)
    actionMiddlewares.splice(index, 1)
  }
}
