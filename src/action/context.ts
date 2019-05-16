export interface ActionContext {
  readonly name: string
  readonly target: object
  readonly args: readonly any[]
  readonly parentContext?: ActionContext
  readonly data: unknown
}

let currentActionContext: ActionContext | undefined

export function getCurrentActionContext() {
  return currentActionContext
}

export function setCurrentActionContext(ctx: ActionContext | undefined) {
  currentActionContext = ctx
}
