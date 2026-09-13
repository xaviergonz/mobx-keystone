import { fastGetParent } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, assertIsObject, failure } from "../utils"
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

type PartialActionMiddleware = Pick<ActionMiddleware, "subtreeRoot" | "filter" | "middleware">

const perObjectActionMiddlewares = new WeakMap<object, PartialActionMiddleware[]>()

/**
 * @internal
 *
 * Returns the action middlewares to be run over a given object, from the object itself to the
 * topmost parent. Since an array like [a, b, c] will be called like c(b(a())) the caller runs
 * them in reverse, so the parent object ones run last.
 *
 * @returns
 */
export function getPerObjectActionMiddlewares(obj: object): PartialActionMiddleware[][] {
  const result: PartialActionMiddleware[][] = []

  let current: unknown = obj
  while (current) {
    const objMwares = perObjectActionMiddlewares.get(current)
    if (objMwares && objMwares.length > 0) {
      result.push(objMwares)
    }
    current = fastGetParent(current, false)
  }

  return result
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
  const { filter } = mware

  assertTweakedObject(subtreeRoot, "middleware.subtreeRoot")
  assertIsFunction(middleware, "middleware.middleware")
  if (filter && typeof filter !== "function") {
    throw failure("middleware.filter must be a function or undefined")
  }

  // reminder: never turn middlewares into actions or else
  // reactions will not be picked up by the undo manager

  // Middleware collection establishes the initial subtree match. The runner
  // revalidates it after user middleware or filter code may have changed parentage.

  const actualMware = { middleware, subtreeRoot, filter }

  // Each action keeps the middleware arrays it collected. Update registrations by
  // replacement so user code cannot shift or extend an in-progress chain.
  const objMwares = perObjectActionMiddlewares.get(subtreeRoot) ?? []
  perObjectActionMiddlewares.set(subtreeRoot, [...objMwares, actualMware])

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    const current = perObjectActionMiddlewares.get(subtreeRoot)!
    perObjectActionMiddlewares.set(
      subtreeRoot,
      current.filter((entry) => entry !== actualMware)
    )
  }
}
