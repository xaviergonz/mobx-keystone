/**
 * An action context.
 *
 * @export
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
   * Tag data for the action context to be set by middlewares, an object.
   */
  readonly data: unknown
}

let currentActionContext: ActionContext | undefined

/**
 * Gets the currently running action context, or undefined if none.
 *
 * @export
 * @returns
 */
export function getCurrentActionContext() {
  return currentActionContext
}

export function setCurrentActionContext(ctx: ActionContext | undefined) {
  currentActionContext = ctx
}
