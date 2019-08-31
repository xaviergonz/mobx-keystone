import { O } from "ts-toolbelt"
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
      return (ctx: O.Writable<ActionContext>) => {
        ctx.previousAsyncStepContext = previousAsyncStepContext
        ctx.spawnAsyncStepContext = previousAsyncStepContext
          ? previousAsyncStepContext.spawnAsyncStepContext
          : ctx
        ctx.asyncStepType = stepType
        ctx.args = args

        previousAsyncStepContext = ctx
      }
    }

    let generatorRun = false
    const gen = wrapInAction(
      name,
      () => {
        generatorRun = true
        return generator.apply(self, args as Args)
      },
      ActionContextActionType.Async,
      ctxOverride(ActionContextAsyncStepType.Spawn)
    ).apply(self)

    if (!generatorRun) {
      // maybe it got overridden into a sync action

      return gen instanceof Promise ? gen : Promise.resolve(gen)
    }

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
                resolution: "reject",

                accepter: resolve,
                rejecter: reject,
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
                resolution: "reject",

                accepter: resolve,
                rejecter: reject,
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
                resolution: "accept",

                accepter: resolve,
                rejecter: reject,
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
  resolution: "accept" | "reject"

  accepter(value: any): void
  rejecter(value: any): void
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
 * A flow function, this is, a function that returns a generator (a generator function).
 */
export type FlowFunction<A extends any[], R> = (...args: A) => Generator<any, R, any>

/**
 * A function that returns a promise.
 */
export type PromiseFunction<A extends any[], R> = (...args: A) => Promise<R>

/**
 * Transforms a flow function into a promise function.
 */
export type FlowFunctionAsPromiseFunction<
  FN extends FlowFunction<any[], any>
> = FN extends FlowFunction<infer A, infer R> ? (...args: A) => Promise<R> : never

/**
 * Tricks the TS compiler into thinking a model flow generator function is a function that
 * returns a promise.
 *
 * ```
 * @modelFlow
 * myFlow = castModelFlow(function*(this: MyModel, _args_) {
 *   ...
 * })
 * ```
 *
 * @typeparam FN Generator function.
 * @param fn Generator function.
 * @returns
 */
export function castModelFlow<FN extends FlowFunction<any[], any>>(
  fn: FN
): FlowFunctionAsPromiseFunction<FN> {
  return fn as any
}

/**
 * Tricks the TS compiler into thinking a yield inside a model flow returns a proper type.
 * Only needed if you actually care about the return value of the promise.
 *
 * ```
 * const myRetValue = castYield(someAsyncFunction, yield someAsyncFunction(args))
 * const myRetValue = castYield(someModel.someFlow, yield someModel.someFlow(args))
 * ```
 *
 * @typeparam FN Promise function.
 * @param _fn Function that returns a promise.
 * @param value Yielded promise.
 * @returns
 */
export function castYield<FN extends PromiseFunction<any[], any>>(
  _fn: FN,
  value: any
): FN extends PromiseFunction<any, infer R> ? R : never {
  return value as any
}
