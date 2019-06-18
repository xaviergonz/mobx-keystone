import { ActionMiddleware, addActionMiddleware } from "../action/middleware"
import { addModelClassInitializer, checkModelDecoratorArgs, Model } from "../model/Model"
import { applyPatches } from "../patch"
import { PatchRecorder, patchRecorder } from "../patch/patchRecorder"
import { assertIsObject, failure } from "../utils"
import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  SimpleActionContext,
} from "./actionTrackingMiddleware"

/**
 * Creates an atomic middleware, which revert changes made by an action / child
 * actions when the root action throws an exception by applying inverse patches.
 *
 * Note that the middleware currently can only undo changes to the model
 * or children of the model, but not to any parents.
 *
 * @typeparam M Model
 * @param target Root target model object and root action name.
 * @returns The actual middleware to pass to `addActionMiddleware`.
 */
export function atomicMiddleware<M extends Model>(target: {
  model: M
  actionName: keyof M
}): ActionMiddleware {
  assertIsObject(target, "target")

  const { model, actionName } = target

  if (!(model instanceof Model)) {
    throw failure("target.model must be a model")
  }

  if (typeof actionName !== "string") {
    throw failure("target.actionName must be a string")
  }

  const patchRecorderSymbol = Symbol("patchRecorder")
  function getPatchRecorder(ctx: SimpleActionContext): PatchRecorder {
    return ctx.rootContext.data[patchRecorderSymbol]
  }

  return actionTrackingMiddleware(target, {
    onStart(ctx) {
      if (ctx === ctx.rootContext) {
        ctx.data[patchRecorderSymbol] = patchRecorder(target.model, { recording: false })
      }
    },
    onResume(ctx) {
      getPatchRecorder(ctx).recording = true
    },
    onSuspend(ctx) {
      getPatchRecorder(ctx).recording = false
    },
    onFinish(ctx, result) {
      if (ctx === ctx.rootContext && result === ActionTrackingResult.Throw) {
        // undo changes
        const pr = getPatchRecorder(ctx)
        const { inversePatches } = pr
        pr.dispose()
        applyPatches(target.model, inversePatches)
      }
    },
  })
}

/**
 * Atomic middleware as a decorator.
 *
 * @param target
 * @param propertyKey
 */
export function atomic(target: any, propertyKey: string): void {
  checkModelDecoratorArgs("atomic", target, propertyKey)

  addModelClassInitializer(target.constructor, modelInstance => {
    addActionMiddleware(
      atomicMiddleware({
        model: modelInstance,
        actionName: propertyKey as any,
      })
    )
  })
}
