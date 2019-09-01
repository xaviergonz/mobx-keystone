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
 * A flow function.
 */
export type FlowFunction<A extends any[], R> = (...args: A) => Generator<any, R, any>

/**
 * Casts a flow function so it can be awaited too.
 */
export type FlowFunctionToPromiseFunction<FN extends FlowFunction<any[], any>> = FN extends (
  ...args: infer A
) => Generator<any, infer R, any>
  ? ((...args: A) => Promise<R>)
  : never

/**
 * Tricks the TS compiler into thinking that a model flow function can be awaited.
 *
 * @typeparam FN Flow function.
 * @param fn Flow function.
 * @returns
 */
export function asModelFlow<FN extends FlowFunction<any[], any>>(
  fn: FN
): FlowFunctionToPromiseFunction<FN> {
  return fn as any
}

// allow promises to be yielded using yield*
const promiseProto: any = Promise.prototype

/*
promiseProto[Symbol.iterator] = function*<T>(
  this: Promise<T>
) {
  const ret: T = yield this
  return ret
}
*/

// above code but compiled by TS for ES5
// so we don't include a dependency to regenerator runtime

const __generator = function(thisArg: any, body: any) {
  let _: any = {
      label: 0,
      sent: function() {
        if (t[0] & 1) throw t[1]
        return t[1]
      },
      trys: [],
      ops: [],
    },
    f: any,
    y: any,
    t: any,
    g: any
  return (
    (g = { next: verb(0), throw: verb(1), return: verb(2) }),
    typeof Symbol === "function" &&
      (g[Symbol.iterator] = function() {
        return this
      }),
    g
  )
  function verb(n: any) {
    return function(v: any) {
      return step([n, v])
    }
  }
  function step(op: any) {
    if (f) throw new TypeError("Generator is already executing.")
    while (_)
      try {
        if (
          ((f = 1),
          y &&
            (t =
              op[0] & 2
                ? y["return"]
                : op[0]
                ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                : y.next) &&
            !(t = t.call(y, op[1])).done)
        )
          return t
        if (((y = 0), t)) op = [op[0] & 2, t.value]
        switch (op[0]) {
          case 0:
          case 1:
            t = op
            break
          case 4:
            _.label++
            return { value: op[1], done: false }
          case 5:
            _.label++
            y = op[1]
            op = [0]
            continue
          case 7:
            op = _.ops.pop()
            _.trys.pop()
            continue
          default:
            if (
              !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
              (op[0] === 6 || op[0] === 2)
            ) {
              _ = 0
              continue
            }
            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
              _.label = op[1]
              break
            }
            if (op[0] === 6 && _.label < t[1]) {
              _.label = t[1]
              t = op
              break
            }
            if (t && _.label < t[2]) {
              _.label = t[2]
              _.ops.push(op)
              break
            }
            if (t[2]) _.ops.pop()
            _.trys.pop()
            continue
        }
        op = body.call(thisArg, _)
      } catch (e) {
        op = [6, e]
        y = 0
      } finally {
        f = t = 0
      }
    if (op[0] & 5) throw op[1]
    return { value: op[0] ? op[1] : void 0, done: true }
  }
}

promiseProto[Symbol.iterator] = function() {
  let ret
  return __generator(this, function(this: any, _a: any) {
    switch (_a.label) {
      case 0:
        return [4 /*yield*/, this]
      case 1:
        ret = _a.sent()
        return [2 /*return*/, ret]
      default:
        return
    }
  })
}
