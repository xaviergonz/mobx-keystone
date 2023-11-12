import { checkDecoratorContext } from "../utils/decorators"
import type { ActionMiddlewareDisposer } from "../action/middleware"
import type { AnyModel } from "../model/BaseModel"
import { assertIsModel } from "../model/utils"
import { addModelClassInitializer } from "../modelShared/modelClassInitializer"
import { applyPatches } from "../patch"
import { internalPatchRecorder, PatchRecorder } from "../patch/patchRecorder"
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
    ctx.rootContext.data[patchRecorderSymbol] = internalPatchRecorder(undefined, {
      recording: false,
    })
  }
  function getPatchRecorder(ctx: SimpleActionContext): PatchRecorder {
    return ctx.rootContext.data[patchRecorderSymbol]
  }

  return actionTrackingMiddleware(model, {
    filter(ctx) {
      // the primary action must be on the root object
      const rootContext = ctx.rootContext
      return rootContext.target === model && rootContext.actionName === actionName
    },
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
    onFinish(ctx, ret) {
      if (ctx === ctx.rootContext) {
        const patchRecorder = getPatchRecorder(ctx)

        try {
          if (ret.result === ActionTrackingResult.Throw) {
            // undo changes (backwards for inverse patches)
            const { events } = patchRecorder
            for (let i = events.length - 1; i >= 0; i--) {
              const event = events[i]
              applyPatches(event.target, event.inversePatches, true)
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
 */
export function transaction(...args: any[]): void {
  if (typeof args[1] === "object") {
    // standard decorators
    const ctx = args[1] as ClassMethodDecoratorContext | ClassFieldDecoratorContext

    checkDecoratorContext("transaction", ctx.name, ctx.static)
    if (ctx.kind !== "method" && ctx.kind !== "field") {
      throw failure(`@transaction can only be used on fields or methods}`)
    }

    ctx.addInitializer(function (this: any) {
      const modelInstance = this
      transactionMiddleware({
        model: modelInstance as AnyModel,
        actionName: ctx.name as any,
      })
    })
  } else {
    // non-standard decorators
    const target = args[0]
    const propertyKey: string | symbol = args[1]

    checkDecoratorContext("transaction", propertyKey, false)

    addModelClassInitializer(target.constructor, (modelInstance) => {
      transactionMiddleware({
        model: modelInstance as AnyModel,
        actionName: propertyKey as any,
      })
    })
  }
}
