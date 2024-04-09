import { fastGetParent } from "../parent/path"
import { isChildOfParent } from "../parent/path2"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, assertIsObject, deleteFromArray, failure } from "../utils"
import type { ActionContext } from "./context"

/**
 * An action middleware.
 */
export interface ActionMiddleware {
  /**
   * Subtree root object (object and child objects) this middleware will run for.
   * This target "filter" will be run before the custom filter.
   */
  readonly subtreeRoot: object

  /**
   * A filter function to decide if an action middleware function should be run or not.
   */
  filter?: (ctx: ActionContext) => boolean

  /**
   * An action middleware function.
   * Rember to `return next()` if you want to continue the action or throw if you want to cancel it.
   */
  middleware: (ctx: ActionContext, next: () => any) => any
}

/**
 * The disposer of an action middleware.
 */
export type ActionMiddlewareDisposer = () => void

type PartialActionMiddleware = Pick<ActionMiddleware, "filter" | "middleware">

const perObjectActionMiddlewares = new WeakMap<object, PartialActionMiddleware[]>()

/**
 * @internal
 *
 * Runs a callback for each action middlewares to be run over a given object.
 *
 * @returns
 */
export function forEachActionMiddleware(
  obj: object,
  callback: (middleware: PartialActionMiddleware) => void
): void {
  // when we call a middleware we will call the middlewares of that object plus all parent objects
  // the parent object middlewares are run last

  // since an array like [a, b, c] will be called like c(b(a())) this means that we need to call
  // the parent object ones at the end of the array

  let current: unknown = obj
  while (current) {
    const objMwares = perObjectActionMiddlewares.get(current)
    if (objMwares && objMwares.length > 0) {
      objMwares.forEach(callback)
    }
    current = fastGetParent(current, false)
  }
}

/**
 * Adds a global action middleware to be run when an action is performed.
 * It is usually preferable to use `onActionMiddleware` instead to limit it to a given tree and only to topmost level actions
 * or `actionTrackingMiddleware` for a simplified middleware.
 *
 * @param mware Action middleware to be run.
 * @returns A disposer to cancel the middleware. Note that if you don't plan to do an early disposal of the middleware
 * calling this function becomes optional.
 */
export function addActionMiddleware(mware: ActionMiddleware): ActionMiddlewareDisposer {
  assertIsObject(mware, "middleware")

  const { middleware, subtreeRoot } = mware
  let { filter } = mware

  assertTweakedObject(subtreeRoot, "middleware.subtreeRoot")
  assertIsFunction(middleware, "middleware.middleware")
  if (filter && typeof filter !== "function") {
    throw failure("middleware.filter must be a function or undefined")
  }

  // reminder: never turn middlewares into actions or else
  // reactions will not be picked up by the undo manager

  if (subtreeRoot) {
    const targetFilter = (ctx: ActionContext) =>
      ctx.target === subtreeRoot || isChildOfParent(ctx.target, subtreeRoot)

    if (!filter) {
      filter = targetFilter
    } else {
      const customFilter = filter
      filter = (ctx) => {
        return targetFilter(ctx) && customFilter(ctx)
      }
    }
  }

  const actualMware = { middleware, filter }

  let objMwares = perObjectActionMiddlewares.get(subtreeRoot)
  if (!objMwares) {
    objMwares = [actualMware]
    perObjectActionMiddlewares.set(subtreeRoot, objMwares)
  } else {
    objMwares.push(actualMware)
  }

  return () => {
    deleteFromArray(objMwares, actualMware)
  }
}
