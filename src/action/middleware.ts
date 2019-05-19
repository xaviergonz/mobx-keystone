import { ActionContext } from "./context"
import { failure } from "../utils"

export type ActionMiddleware = (ctx: ActionContext, next: () => any) => any
export type ActionMiddlewareDisposer = () => void
export type ActionMiddlewareFilter = (ctx: ActionContext) => boolean

const actionMiddlewares: { fn: ActionMiddleware; filter?: ActionMiddlewareFilter }[] = []

export function getActionMiddlewares() {
  return actionMiddlewares
}

export function addActionMiddleware(
  mware: ActionMiddleware,
  filter?: ActionMiddlewareFilter
): ActionMiddlewareDisposer {
  if (typeof mware !== "function") {
    throw failure("a middleware must be a function")
  }

  if (actionMiddlewares.findIndex(m => m.fn === mware) >= 0) {
    throw failure("middleware already present")
  }

  actionMiddlewares.push({ fn: mware, filter })
  return () => {
    const index = actionMiddlewares.findIndex(m => m.fn === mware)
    actionMiddlewares.splice(index, 1)
  }
}
