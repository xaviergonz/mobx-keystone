import { action, isAction } from "mobx"
import { AnyModel, Model } from "../model/Model"
import { assertIsModel } from "../model/utils"
import { getParent, isChildOfParent } from "../parent/path"
import { assertIsObject, deleteFromArray, failure } from "../utils"
import { ActionContext } from "./context"

/**
 * An action middleware.
 */
export interface ActionMiddleware {
  /**
   * Subtree (object and child objects) this middleware will run for.
   * This target "filter" will be run before the custom filter.
   */
  target: AnyModel

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

type PartialActionMiddleware = Pick<ActionMiddleware, "filter" | "middleware">
const perModelActionMiddlewares = new WeakMap<AnyModel, PartialActionMiddleware[]>()

/**
 * @ignore
 *
 * Gets the current action middlewares to be run over a given model.
 *
 * @returns
 */
export function getActionMiddlewares(model: AnyModel): PartialActionMiddleware[] {
  const mwares = []

  // when we call a middleware we will call the middlewares of that model plus all parent models
  // the parent model middlewares are run last

  // since an array like [a, b, c] will be called like c(b(a())) this means that we need to put
  // the parent model ones at the end of the array

  let current: any = model
  while (current) {
    if (current instanceof Model) {
      const modelMwares = perModelActionMiddlewares.get(current)
      if (modelMwares) {
        mwares.push(...modelMwares)
      }
    }
    current = getParent(current)
  }

  return mwares
}

/**
 * Adds a global action middleware to be run when an action is performed.
 * It is usually preferable to use `onAction` instead to limit it to a given tree and only to topmost level actions
 * or `actionTrackingMiddleware` for a simplified middleware.
 *
 * @param mware Action middleware to be run.
 * @returns A disposer to cancel the middleware. Note that if you don't plan to do an early disposal of the middleware
 * calling this function becomes optional.
 */
export function addActionMiddleware(mware: ActionMiddleware): ActionMiddlewareDisposer {
  assertIsObject(mware, "middleware")

  let { middleware, filter, target } = mware

  assertIsModel(target, "middleware.target")
  if (typeof middleware !== "function") {
    throw failure("middleware.middleware must be a function")
  }
  if (filter && typeof filter !== "function") {
    throw failure("middleware.filter must be a function or undefined")
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
      filter = ctx => {
        return targetFilter(ctx) && customFilter(ctx)
      }
    }
  }

  const actualMware = { middleware, filter }

  let modelMwares = perModelActionMiddlewares.get(target)!
  if (!modelMwares) {
    modelMwares = [actualMware]
    perModelActionMiddlewares.set(target, modelMwares)
  } else {
    modelMwares.push(actualMware)
  }

  return () => {
    deleteFromArray(modelMwares, actualMware)
  }
}
