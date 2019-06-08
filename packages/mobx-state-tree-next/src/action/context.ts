/**
 * An action context.
 *
 * @interface ActionContext
 */
export interface ActionContext {
  /**
   * Action name
   */
  readonly name: string
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
  readonly parentContext?: ActionContext
  /**
   * Previous async step context, undefined for sync actions or the first action of a flow.
   */
  readonly previousAsyncStepContext?: ActionContext
  /**
   * Custom data for the action context to be set by middlewares, an object.
   */
  readonly data: unknown
}

let currentActionContext: ActionContext | undefined

/**
 * Gets the currently running action context, or undefined if none.
 *
 * @returns
 */
export function getCurrentActionContext() {
  return currentActionContext
}

/**
 * @ignore
 *
 * Sets the current action context.
 *
 * @param ctx Current action context.
 */
export function setCurrentActionContext(ctx: ActionContext | undefined) {
  currentActionContext = ctx
}

/**
 * Simplifies an action context by turning an async call hierarchy into a similar sync one.
 *
 * @param ctx
 * @returns
 */
export function asyncToSyncActionContext(ctx: ActionContext): ActionContext {
  while (ctx.previousAsyncStepContext) {
    ctx = ctx.previousAsyncStepContext
  }

  return {
    ...ctx,
    parentContext: ctx.parentContext ? asyncToSyncActionContext(ctx.parentContext) : undefined,
  }
}
