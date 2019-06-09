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
   * Async step type, or undefined for sync actions.
   */
  readonly asyncStepType?: ActionContextAsyncStepType
  /**
   * Custom data for the action context to be set by middlewares, an object.
   */
  readonly data: unknown
}

/**
 * An async step type.
 */
export enum ActionContextAsyncStepType {
  /**
   * The flow is about to start.
   */
  Spawn = "spawn",
  /**
   * The flow is about to return (finish).
   */
  Return = "return",
  /**
   * The flow is about to continue.
   */
  Resume = "resume",
  /**
   * The flow yield just threw, which might be recovered (caught) or not.
   */
  ResumeError = "resumeError",
  /**
   * The flow is about to throw an error to the flow caller.
   */
  Throw = "throw",
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
