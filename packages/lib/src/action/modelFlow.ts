import { Writable } from "ts-essentials"
import { checkModelDecoratorArgs } from "../model/utils"
import { decorateWrapMethodOrField, failure } from "../utils"
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

    // use bound functions to fix es6 compilation
    const genNext = gen.next.bind(gen)
    const genThrow = gen.throw!.bind(gen)

    const promise = new Promise<R>(function(resolve, reject) {
      function onFulfilled(res: any): void {
        let ret
        try {
          ret = wrapInAction(
            name,
            genNext,
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Resume)
          ).call(self, res)
        } catch (e) {
          wrapInAction(
            name,
            (err: any) => {
              // we use a flow finisher to allow middlewares to tweak the return value before resolution
              return {
                value: err,
                resolver: reject,
              } as FlowFinisher
            },
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Throw),
            true
          ).call(self, e)
          return
        }

        next(ret)
      }

      function onRejected(err: any): void {
        let ret
        try {
          ret = wrapInAction(
            name,
            genThrow,
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.ResumeError)
          ).call(self, err)
        } catch (e) {
          wrapInAction(
            name,
            (err: any) => {
              // we use a flow finisher to allow middlewares to tweak the return value before resolution
              return {
                value: err,
                resolver: reject,
              } as FlowFinisher
            },
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Throw),
            true
          ).call(self, e)
          return
        }

        next(ret)
      }

      function next(ret: any): void {
        if (ret && typeof ret.then === "function") {
          // an async iterator
          ret.then(next, reject)
        } else if (ret.done) {
          // done
          wrapInAction(
            name,
            (val: any) => {
              // we use a flow finisher to allow middlewares to tweak the return value before resolution
              return {
                value: val,
                resolver: resolve,
              } as FlowFinisher
            },
            ActionContextActionType.Async,
            ctxOverride(ActionContextAsyncStepType.Return),
            true
          ).call(self, ret.value)
        } else {
          // continue
          Promise.resolve(ret.value).then(onFulfilled, onRejected)
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
 * @ignore
 */
export interface FlowFinisher {
  value: any
  resolver(value: any): void
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
  return decorateWrapMethodOrField(
    {
      target,
      propertyKey,
      baseDescriptor,
    },
    (data, fn) => {
      if (isModelFlow(fn)) {
        return fn
      } else {
        checkModelFlowArgs(data.target, data.propertyKey, fn)
        return flow(
          data.propertyKey,
          fn
        )
      }
    }
  )
}

function checkModelFlowArgs(target: any, propertyKey: string, value: any) {
  if (typeof value !== "function") {
    throw failure("modelFlow has to be used over functions")
  }
  checkModelDecoratorArgs("modelFlow", target, propertyKey)
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
