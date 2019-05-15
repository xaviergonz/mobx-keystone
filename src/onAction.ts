import { isObservable, toJS } from "mobx"
import { ActionContext, addActionMiddleware } from "./action"
import { getSnapshot } from "./getSnapshot"
import { getRootPath, isChildOfParent } from "./parent"
import { isTweakedObject, tweak } from "./tweaker"
import { isObject, isPlainObject } from "./utils"

export interface SerializableAction {
  readonly name: string
  readonly args: readonly any[]
  readonly path: readonly string[]
}

export function onAction<T extends object>(
  target: T,
  listener: (serializableAction: SerializableAction, actionContext: ActionContext) => void,
  options?: {
    attach?: "before" | "after"
  }
): () => void {
  const opts = {
    attach: "before",
    ...options,
  }

  const attachAfter = opts.attach === "after"

  // make sure the value is a tweaked value first
  if (!isTweakedObject(target)) {
    target = tweak(target, undefined)
  }

  const middleware = addActionMiddleware(
    (ctx, next) => {
      if (ctx.parentContext) {
        // sub-action, do nothing
        return next()
      }

      const serializableAction = actionContextToSerializableAction(ctx)

      if (!attachAfter) {
        listener(serializableAction, ctx)
      }

      const ret = next()

      if (attachAfter) {
        listener(serializableAction, ctx)
      }

      return ret
    },
    ctx => {
      return ctx.target === target || isChildOfParent(ctx.target, target)
    }
  )

  return middleware
}

function serializeArgument(a: any): any {
  if (!isObject(a)) {
    return a
  }
  if (isTweakedObject(a)) {
    return getSnapshot(a)
  }

  const originalA = a
  if (isObservable(a)) {
    a = toJS(a, { exportMapsAsObjects: false, detectCycles: false })
  }
  if (isPlainObject(a) || Array.isArray(a)) {
    return a
  }

  return {
    $unserializable: true,
    value: originalA,
  }
}

function actionContextToSerializableAction(ctx: ActionContext): SerializableAction {
  const rootPath = getRootPath(ctx.target)

  return {
    name: ctx.name,
    args: ctx.args.map(serializeArgument),
    path: rootPath.path,
  }
}
