import { Writable } from "ts-essentials"
import { Model } from "../model/Model"
import { addHiddenProp, failure } from "../utils"
import { ActionContext, ActionContextActionType, ActionContextAsyncStepType } from "./context"
import { wrapInAction } from "./wrapInAction"

const modelFlowSymbol = Symbol("modelFlow")

function flow<R, Args extends any[]>(
  name: string,
  generator: (...args: Args) => IterableIterator<any>
): (...args: Args) => Promise<any> {
  // Implementation based on https://github.com/tj/co/blob/master/index.js
  const flowFn = function(this: any, ...args: any[]) {
    const self = this

    let previousAsyncStepContext: ActionContext | undefined

    const ctxOverride = (stepType: ActionContextAsyncStepType) => {
      return (ctx: Writable<ActionContext>) => {
        ctx.previousAsyncStepContext = previousAsyncStepContext
        ctx.asyncStepType = stepType
        ctx.args = args

        previousAsyncStepContext = ctx
      }
    }

    const gen = wrapInAction(
      name,
      generator,
      ActionContextActionType.Async,
      ctxOverride(ActionContextAsyncStepType.Spawn)
    ).apply(self, args as Args)

    const promise = new Promise<R>(function(resolve, reject) {
      function onFulfilled(res: any) {
        let ret
        try {
          ret = wrapInAction(
            name,
            gen.next,
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Resume)
          ).call(self, res)
        } catch (e) {
          return wrapInAction(
            name,
            (err: any) => {
              reject(err)
              return err // so it is available to middlewares
            },
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Throw)
          ).call(self, e)
        }

        next(ret)
      }

      function onRejected(err: any) {
        let ret
        try {
          ret = wrapInAction(
            name,
            gen.throw!,
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.ResumeError)
          ).call(self, err)
        } catch (e) {
          return wrapInAction(
            name,
            (err: any) => {
              reject(err)
              return err // so it is available to middlewares
            },
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Throw)
          ).call(self, e)
        }

        next(ret)
      }

      function next(ret: any) {
        if (ret && typeof ret.then === "function") {
          // an async iterator
          ret.then(next, reject)
          return
        }
        if (ret.done) {
          // done
          return wrapInAction(
            name,
            (val: any) => {
              resolve(val)
              return val // so it is available to middlewares
            },
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Return)
          ).call(self, ret.value)
        } else {
          // continue
          return Promise.resolve(ret.value).then(onFulfilled, onRejected)
        }
      }

      onFulfilled(undefined) // kick off the process
    })

    return promise
  }
  ;(flowFn as any)[modelFlowSymbol] = true

  return flowFn
}

/**
 * Returns if the given function is a model flow or not.
 *
 * @param fn Function to check.
 * @returns
 */
export function isModelFlow(fn: any) {
  return typeof fn === "function" && fn[modelFlowSymbol]
}

/**
 * Decorator that turns a function generator into a model flow.
 *
 * @param target
 * @param propertyKey
 * @param [baseDescriptor]
 * @returns
 */
export function modelFlow(
  target: any,
  propertyKey: string,
  baseDescriptor?: PropertyDescriptor
): void {
  if (baseDescriptor) {
    // method decorator
    const fn = baseDescriptor.value
    checkModelFlowArgs(target, propertyKey, fn)

    return {
      enumerable: false,
      writable: true,
      configurable: true,
      value: flow(
        propertyKey,
        fn as any
      ),
    } as any
  } else {
    // field decorator
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: false,
      get() {
        return undefined
      },
      set(value) {
        const fn = value
        checkModelFlowArgs(this, propertyKey, fn)

        addHiddenProp(
          this,
          propertyKey,
          flow(
            propertyKey,
            fn as any
          )
        )
      },
    })
  }
}

export function checkModelFlowArgs(target: any, propertyKey: string, value: any) {
  if (typeof value !== "function") {
    throw failure("modelFlow has to be used over functions")
  }
  if (typeof propertyKey !== "string") {
    throw failure("modelFlow cannot be used over symbol properties")
  }

  const errMessage = "modelFlow must be used over model classes or instances"

  if (!target) {
    throw failure(errMessage)
  }

  // check target is a model object or extended class
  if (!(target instanceof Model) && target !== Model && !(target.prototype instanceof Model)) {
    throw failure(errMessage)
  }
}

/**
 * Type that gets the right return type of a flow.
 *
 * ```
 * // outside flows
 * const ret: FlowRet<typeof model.someFlow> = await model.someFlow() as any
 *
 * // inside flows
 * const ret: FlowRet<typeof model.someFlow> = yield model.someFlow()
 * const ret: FlowRet<typeof someAsyncFunc> = yield someAsyncFunc()
 * ```
 */
export type FlowRet<
  FN extends (...args: any[]) => IterableIterator<any> | Promise<any>
> = FN extends (...args: any[]) => IterableIterator<infer R>
  ? Exclude<R, Promise<any> | IterableIterator<any>>
  : FN extends (...args: any[]) => Promise<infer R>
  ? R
  : never
