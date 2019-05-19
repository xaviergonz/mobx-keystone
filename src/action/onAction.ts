import { isObservable, toJS } from "mobx"
import { ActionContext } from "./context"
import { addActionMiddleware } from "./middleware"
import { getSnapshot } from "../snapshot/getSnapshot"
import { getRootPath, isChildOfParent } from "../parent"
import { isObject, isPlainObject, failure } from "../utils"
import { isTweakedObject } from "../tweaker/core"
import { Model } from "../model/Model"

export interface SerializableActionCall {
  readonly name: string
  readonly args: readonly any[]
  readonly path: readonly string[]
}

export function onAction(
  target: Model,
  listener: (serializableActionCall: SerializableActionCall, actionContext: ActionContext) => void,
  options?: {
    attach?: "before" | "after"
  }
): () => void {
  if (!(target instanceof Model)) {
    throw failure("onAction target must be a model")
  }

  const opts = {
    attach: "before",
    ...options,
  }

  const attachAfter = opts.attach === "after"

  const middleware = addActionMiddleware(
    (ctx, next) => {
      if (ctx.parentContext) {
        // sub-action, do nothing
        return next()
      }

      const serializableActionCall = actionContextToSerializableActionCall(ctx)

      if (!attachAfter) {
        listener(serializableActionCall, ctx)
      }

      const ret = next()

      if (attachAfter) {
        listener(serializableActionCall, ctx)
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

function actionContextToSerializableActionCall(ctx: ActionContext): SerializableActionCall {
  const rootPath = getRootPath(ctx.target)

  return {
    name: ctx.name,
    args: ctx.args.map(serializeArgument),
    path: rootPath.path,
  }
}
