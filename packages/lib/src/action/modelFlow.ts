import type { O } from "ts-toolbelt"
import { failure } from "../utils"
import { ActionContext, ActionContextActionType, ActionContextAsyncStepType } from "./context"
import { WrapInActionOverrideContextFn, wrapInAction } from "./wrapInAction"
import { decorateWrapMethodOrField } from "../utils/decorators"
import { promiseGenerator } from "./modelFlowPromiseGenerator"

const modelFlowSymbol = Symbol("modelFlow")

/**
 * @internal
 */
export function flow<R, Args extends any[]>({
  nameOrNameFn,
  generator,
  overrideContext,
}: {
  nameOrNameFn: string | (() => string)
  generator: (...args: Args) => IterableIterator<any>
  overrideContext?: WrapInActionOverrideContextFn
}): (...args: Args) => Promise<any> {
  // Implementation based on https://github.com/tj/co/blob/master/index.js
  const flowFn = function (this: any, ...args: any[]) {
    const name = typeof nameOrNameFn === "function" ? nameOrNameFn() : nameOrNameFn

    const target = this

    let previousAsyncStepContext: ActionContext | undefined

    const ctxOverride = (stepType: ActionContextAsyncStepType): WrapInActionOverrideContextFn => {
      return (ctx: O.Writable<ActionContext>, self) => {
        if (overrideContext) {
          overrideContext(ctx, self)
        }

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
    const gen = wrapInAction({
      nameOrNameFn: name,
      fn: () => {
        generatorRun = true
        return generator.apply(target, args as Args)
      },
      actionType: ActionContextActionType.Async,
      overrideContext: ctxOverride(ActionContextAsyncStepType.Spawn),
    }).apply(target)

    if (!generatorRun) {
      // maybe it got overridden into a sync action

      return gen instanceof Promise ? gen : Promise.resolve(gen)
    }

    // use bound functions to fix es6 compilation
    const genNext = gen.next.bind(gen)
    const genThrow = gen.throw!.bind(gen)

    const promise = new Promise<R>((resolve, reject) => {
      function onFulfilled(res: any): void {
        let ret: unknown
        try {
          ret = wrapInAction({
            nameOrNameFn: name,
            fn: genNext,
            actionType: ActionContextActionType.Async,
            overrideContext: ctxOverride(ActionContextAsyncStepType.Resume),
          }).call(target, res)
        } catch (e) {
          wrapInAction({
            nameOrNameFn: name,
            fn: (err: any) => {
              // we use a flow finisher to allow middlewares to tweak the return value before resolution
              return {
                value: err,
                resolution: "reject",

                accepter: resolve,
                rejecter: reject,
              } as FlowFinisher
            },
            actionType: ActionContextActionType.Async,
            overrideContext: ctxOverride(ActionContextAsyncStepType.Throw),
            isFlowFinisher: true,
          }).call(target, e)
          return
        }

        next(ret)
      }

      function onRejected(err: unknown): void {
        let ret: unknown
        try {
          ret = wrapInAction({
            nameOrNameFn: name,
            fn: genThrow,
            actionType: ActionContextActionType.Async,
            overrideContext: ctxOverride(ActionContextAsyncStepType.ResumeError),
          }).call(target, err)
        } catch (e) {
          wrapInAction({
            nameOrNameFn: name,
            fn: (err: any) => {
              // we use a flow finisher to allow middlewares to tweak the return value before resolution
              return {
                value: err,
                resolution: "reject",

                accepter: resolve,
                rejecter: reject,
              } as FlowFinisher
            },
            actionType: ActionContextActionType.Async,
            overrideContext: ctxOverride(ActionContextAsyncStepType.Throw),
            isFlowFinisher: true,
          }).call(target, e)
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
          wrapInAction({
            nameOrNameFn: name,
            fn: (val: any) => {
              // we use a flow finisher to allow middlewares to tweak the return value before resolution
              return {
                value: val,
                resolution: "accept",

                accepter: resolve,
                rejecter: reject,
              } as FlowFinisher
            },
            actionType: ActionContextActionType.Async,
            overrideContext: ctxOverride(ActionContextAsyncStepType.Return),
            isFlowFinisher: true,
          }).call(target, ret.value)
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
 * @internal
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
export function isModelFlow(fn: unknown) {
  return typeof fn === "function" && modelFlowSymbol in fn
}

/**
 * Decorator that turns a function generator into a model flow.
 */
export function modelFlow(...args: any[]): void {
  // biome-ignore lint/correctness/noVoidTypeReturn: proper way to declare a decorator
  return decorateWrapMethodOrField("modelFlow", args, (data, fn) => {
    if (isModelFlow(fn)) {
      return fn
    } else {
      if (typeof fn !== "function") {
        throw failure("modelFlow has to be used over functions")
      }

      return flow({
        nameOrNameFn: data.actionName,
        generator: fn,
        overrideContext: data.overrideContext,
      })
    }
  })
}

/**
 * Tricks the TS compiler into thinking that a model flow generator function can be awaited
 * (is a promise).
 *
 * @template A Function arguments.
 * @template R Return value.
 * @param fn Flow function.
 * @returns
 */
export function _async<A extends any[], R>(
  fn: (...args: A) => Generator<any, R, any>
): (...args: A) => Promise<R> {
  return fn as any
}

/**
 * Makes a promise a flow, so it can be awaited with yield*.
 *
 * @template T Promise return type.
 * @param promise Promise.
 * @returns
 */
export function _await<T>(promise: Promise<T>): Generator<Promise<T>, T, unknown> {
  return promiseGenerator.call(promise)
}
