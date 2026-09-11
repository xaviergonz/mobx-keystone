import type { ActionMiddlewareDisposer } from "../action/middleware"
import type { AnyModel } from "../model/BaseModel"
import { assertIsModel } from "../model/utils"
import { addModelClassInitializer } from "../modelShared/modelClassInitializer"
import { applyPatches } from "../patch"
import { internalPatchRecorder, type PatchRecorder } from "../patch/patchRecorder"
import { assertIsObject, failure } from "../utils"
import { checkDecoratorContext } from "../utils/decorators"
import {
  ActionTrackingResult,
  actionTrackingMiddleware,
  type SimpleActionContext,
} from "./actionTrackingMiddleware"

/**
 * Creates a transaction middleware, which reverts changes made by an action / child
 * actions when the root action throws an exception by applying inverse patches.
 *
 * @template M Model
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
    ctx.rootContext.data[patchRecorderSymbol] = {
      recorder: internalPatchRecorder(undefined, { recording: false }),
      activeCount: 0,
    }
  }
  function getPatchRecorderData(ctx: SimpleActionContext): {
    recorder: PatchRecorder
    activeCount: number
  } {
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
    // Actions nest, so recording must only stop once every action of the transaction
    // has been suspended, not as soon as the innermost one returns.
    onResume(ctx) {
      const data = getPatchRecorderData(ctx)
      data.activeCount++
      data.recorder.recording = true
    },
    onSuspend(ctx) {
      const data = getPatchRecorderData(ctx)
      data.activeCount--
      data.recorder.recording = data.activeCount > 0
    },
    onFinish(ctx, ret) {
      if (ctx === ctx.rootContext) {
        const patchRecorder = getPatchRecorderData(ctx).recorder

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
