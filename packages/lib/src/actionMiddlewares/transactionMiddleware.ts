import type { ActionMiddlewareDisposer } from "../action/middleware"
import { runUnprotected } from "../action/runUnprotected"
import type { AnyModel } from "../model/BaseModel"
import { assertIsModel } from "../model/utils"
import { addModelClassInitializer } from "../modelShared/modelClassInitializer"
import { ChangeRollbackRecorder } from "../tweaker/changeRollback"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { assertIsObject, failure, MobxKeystoneAggregateError } from "../utils"
import { checkDecoratorContext } from "../utils/decorators"
import { pushDelayedError } from "../utils/forEachWithDelayedThrow"
import {
  ActionTrackingResult,
  actionTrackingMiddleware,
  type SimpleActionContext,
} from "./actionTrackingMiddleware"

/**
 * Creates a transaction middleware, which reverts changes made by an action / child
 * actions when the root action throws an exception, restoring the values those changes replaced.
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

  const rollbackRecorderSymbol = Symbol("rollbackRecorder")
  function initRollbackRecorder(ctx: SimpleActionContext) {
    ctx.rootContext.data[rollbackRecorderSymbol] = {
      recorder: new ChangeRollbackRecorder(),
      activeCount: 0,
    }
  }
  function getRollbackRecorderData(ctx: SimpleActionContext): {
    recorder: ChangeRollbackRecorder
    activeCount: number
  } {
    return ctx.rootContext.data[rollbackRecorderSymbol]
  }

  return actionTrackingMiddleware(model, {
    filter(ctx) {
      // the primary action must be on the root object
      const rootContext = ctx.rootContext
      return rootContext.target === model && rootContext.actionName === actionName
    },
    onStart(ctx) {
      if (ctx === ctx.rootContext) {
        initRollbackRecorder(ctx)
      }
    },
    // Actions nest, so recording must only stop once every action of the transaction
    // has been suspended, not as soon as the innermost one returns.
    onResume(ctx) {
      const data = getRollbackRecorderData(ctx)
      data.activeCount++
      data.recorder.recording = true
    },
    onSuspend(ctx) {
      const data = getRollbackRecorderData(ctx)
      data.activeCount--
      data.recorder.recording = data.activeCount > 0
    },
    onFinish(ctx, ret) {
      if (ctx === ctx.rootContext) {
        const recorder = getRollbackRecorderData(ctx).recorder
        // stop recording, so the rollback is not recorded as well
        recorder.dispose()

        if (ret.result === ActionTrackingResult.Throw) {
          // revert changes (backwards). Restoring the replaced values themselves
          // (rather than applying inverse patches) keeps node identities, so
          // nodes that were detached and then changed are restored too.
          const { reverts } = recorder
          const rollbackErrors: unknown[] = []
          runUnprotected(() => {
            // it restores the state before the action, which was already checked
            withoutTypeChecking(() => {
              for (let i = reverts.length - 1; i >= 0; i--) {
                // A listener may throw after a change has already been reverted.
                // Keep going so one failure cannot skip the remaining restoration.
                try {
                  reverts[i]()
                } catch (error) {
                  pushDelayedError(rollbackErrors, error)
                }
              }
            })
          })
          if (rollbackErrors.length > 0) {
            // Keep the action error first so the reason for the rollback is not lost.
            throw new MobxKeystoneAggregateError(
              [ret.value, ...rollbackErrors],
              "transaction rollback callbacks failed"
            )
          }
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
      throw failure(`@transaction can only be used on fields or methods`)
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
