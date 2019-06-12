import { isObservable, toJS } from "mobx"
import { Model } from "../model/Model"
import { getRootPath } from "../parent"
import { getSnapshot } from "../snapshot/getSnapshot"
import { isTweakedObject } from "../tweaker/core"
import { failure, isObject, isPlainObject } from "../utils"
import { ActionContext } from "./context"
import { ActionMiddleware } from "./middleware"

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
   */
  readonly args: readonly any[]
  /**
   * Path to the subobject where the action will be run, as an array of strings.
   */
  readonly path: readonly string[]
}

export type ActionSerializerListener = (
  serializableActionCall: SerializableActionCall,
  actionContext: ActionContext,
  next: () => any
) => void

export type ActionSerializerUnserializableArgument = (
  actionContext: ActionContext,
  value: any,
  index: number
) => any

/**
 * Creates an action middleware that serializes a given action / all actions of a given tree.
 * Remember to `return next()` if you want to continue the action or throw if you want to cancel it.
 * Note that `actionSerializerMiddleware` will only run for the topmost level actions, so it won't run for child actions or intermediary flow steps.
 *
 * @param target Root target model object, including action name if it should run for only a given action rather than all actions of the tree.
 * @param listener Listener function that will be invoked everytime a topmost action is invoked on the model or any children.
 * @param [options] `onUnserializableArgument` is an optional function that will be invoked when an unserializable argument is found. The default is to
 * throw an error that cancels the action, but it can be changed to return your own serializable value, print a warning, etc.
 * @returns The actual middleware to be passed to `addActionMiddleware`.
 */
export function actionSerializerMiddleware<M extends Model>(
  target: {
    model: M
    actionName?: keyof M
  },
  listener: ActionSerializerListener,
  options?: {
    onUnserializableArgument?: ActionSerializerUnserializableArgument
  }
): ActionMiddleware {
  if (!isObject(target)) {
    throw failure("target must be an object")
  }

  const { model, actionName } = target

  if (!(model instanceof Model)) {
    throw failure("target must be a model")
  }

  if (actionName && typeof model[actionName] !== "function") {
    throw failure("action must be a function or undefined")
  }

  const filter: ActionMiddleware["filter"] = ctx => {
    if (ctx.parentContext || ctx.previousAsyncStepContext) {
      // sub-action or async step, do nothing
      return false
    }

    if (actionName && ctx.name !== actionName) {
      return false
    }

    return true
  }

  return {
    middleware(ctx, next) {
      if (ctx.parentContext || ctx.previousAsyncStepContext) {
        // sub-action or async step, do nothing
        return next()
      }

      const serializableActionCall = actionContextToSerializableActionCall(
        ctx,
        options && options.onUnserializableArgument
      )

      return listener(serializableActionCall, ctx, next)
    },
    target: model,
    filter,
  }
}

function serializeArgument(
  ctx: ActionContext,
  value: any,
  index: number,
  onUnserializableArgument: ActionSerializerUnserializableArgument | undefined
): any {
  if (!isObject(value)) {
    return value
  }
  if (isTweakedObject(value)) {
    return getSnapshot(value)
  }

  const originalValue = value
  if (isObservable(value)) {
    value = toJS(value, { exportMapsAsObjects: false, detectCycles: false })
  }
  if (isPlainObject(value) || Array.isArray(value)) {
    return value
  }

  if (onUnserializableArgument) {
    return onUnserializableArgument(ctx, originalValue, index)
  } else {
    const actionStr = getRootPath(ctx.target).path.join("/") + "." + ctx.name
    throw failure(
      `onAction found argument #${index} is unserializable while running ${actionStr}() - consider using 'onUnserializableArgument'`
    )
  }
}

function actionContextToSerializableActionCall(
  ctx: ActionContext,
  onUnserializableArgument: ActionSerializerUnserializableArgument | undefined
): SerializableActionCall {
  const rootPath = getRootPath(ctx.target)

  return {
    name: ctx.name,
    args: ctx.args.map((arg, i) => serializeArgument(ctx, arg, i, onUnserializableArgument)),
    path: rootPath.path,
  }
}
