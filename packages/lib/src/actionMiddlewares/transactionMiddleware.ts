import { ActionMiddlewareDisposer } from "../action/middleware"
import {
  addModelClassInitializer,
  AnyModel,
  assertIsModel,
  checkModelDecoratorArgs,
} from "../model/Model"
import { applyPatches } from "../patch"
import { globalPatchRecorder, GlobalPatchRecorder } from "../patch/globalPatchRecorder"
import { assertIsObject, failure } from "../utils"
import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  SimpleActionContext,
} from "./actionTrackingMiddleware"

/**
 * Creates a transaction middleware, which reverts changes made by an action / child
 * actions when the root action throws an exception by applying inverse patches.
 *
 * @typeparam M Model
 * @param target Object with the root target model object (`model`) and root action name (`actionName`).
 * @returns The middleware disposer.
 */
export function transactionMiddleware<M extends AnyModel>(target: {
  model: M
  actionName: keyof M
}): ActionMiddlewareDisposer {
  assertIsObject(target, "target")

  const { model, actionName } = target

  assertIsModel(model, "target.model")

  if (typeof actionName !== "string") {
    throw failure("target.actionName must be a string")
  }

  const patchRecorderSymbol = Symbol("patchRecorder")
  function initPatchRecorder(ctx: SimpleActionContext) {
    ctx.rootContext.data[patchRecorderSymbol] = globalPatchRecorder({ recording: false })
  }
  function getPatchRecorder(ctx: SimpleActionContext): GlobalPatchRecorder {
    return ctx.rootContext.data[patchRecorderSymbol]
  }

  return actionTrackingMiddleware(target, {
    onStart(ctx) {
      if (ctx === ctx.rootContext) {
        initPatchRecorder(ctx)
      }
    },
    onResume(ctx) {
      getPatchRecorder(ctx).recording = true
    },
    onSuspend(ctx) {
      getPatchRecorder(ctx).recording = false
    },
    onFinish(ctx, result) {
      if (ctx === ctx.rootContext) {
        const patchRecorder = getPatchRecorder(ctx)

        try {
          if (result === ActionTrackingResult.Throw) {
            // undo changes (backwards for inverse patches)
            const { events } = patchRecorder
            for (let i = events.length - 1; i >= 0; i--) {
              const event = events[i]
              applyPatches(event.target, event.inversePatches)
            }
          }
        } finally {
          patchRecorder.dispose()
        }
      }
    },
  })
}

/**
 * Transaction middleware as a decorator.
 *
 * @param target
 * @param propertyKey
 */
export function transaction(target: any, propertyKey: string): void {
  checkModelDecoratorArgs("transaction", target, propertyKey)

  addModelClassInitializer(target.constructor, modelInstance => {
    transactionMiddleware({
      model: modelInstance,
      actionName: propertyKey as any,
    })
  })
}
