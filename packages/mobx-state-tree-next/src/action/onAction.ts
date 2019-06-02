import { isObservable, toJS } from "mobx"
import { Model } from "../model/Model"
import { getRootPath, isChildOfParent } from "../parent"
import { getSnapshot } from "../snapshot/getSnapshot"
import { isTweakedObject } from "../tweaker/core"
import { failure, isObject, isPlainObject } from "../utils"
import { ActionContext } from "./context"
import { addActionMiddleware } from "./middleware"

/**
 * A serializable action call.
 */
export interface SerializableActionCall {
  /**
   * Action name (name of the function).
   */
  readonly name: string
  /**
   * Action arguments in a serializable form.
   * If a value is not serializable it will be turned into an object like this:
   * ```
   * {
   *   $unserializable: true,
   *   value: originalValue,
   * }
   * ```
   */
  readonly args: readonly any[]
  /**
   * Path to the subobject where the action will be run, as an array of strings.
   */
  readonly path: readonly string[]
}

/**
 * Adds an action middleware that only applies to a given tree.
 * Remember to `return next()` if you want to continue the action or throw if you want to cancel it.
 * Note that `onAction` will only run for the topmost level actions, so it won't run for child actions.
 *
 * @param target Root target model object.
 * @param listener Listener function that will be invoked everytime a topmost action is invoked on the model or any children.
 * @returns
 */
export function onAction(
  target: Model,
  listener: (
    serializableActionCall: SerializableActionCall,
    actionContext: ActionContext,
    next: () => any
  ) => void
): () => void {
  if (!(target instanceof Model)) {
    throw failure("onAction target must be a model")
  }

  const middleware = addActionMiddleware(
    (ctx, next) => {
      if (ctx.parentContext) {
        // sub-action, do nothing
        return next()
      }

      const serializableActionCall = actionContextToSerializableActionCall(ctx)

      return listener(serializableActionCall, ctx, next)
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
