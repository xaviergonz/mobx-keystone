import { Model } from "../model/Model"

/**
 * An action context.
 */
export interface ActionContext {
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
  readonly target: Model
  /**
   * Array of action arguments.
   */
  readonly args: readonly any[]
  /**
   * Parent action context.
   */
  readonly parentContext?: ActionContext
  /**
   * Root action context.
   */
  readonly rootContext: ActionContext
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
  readonly data: any
}

/**
 * Action type, sync or async.
 */
export enum ActionContextActionType {
  Sync = "sync",
  Async = "async",
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
