import {
  _async,
  _await,
  ActionContextAsyncStepType,
  addActionMiddleware,
  Model,
  modelFlow,
  objectActions,
  prop,
  toTreeNode,
  undoMiddleware,
} from "../../src"
import { testModel } from "../utils"

test("_await yields its promise and returns the resumed value", () => {
  const promise = Promise.resolve(7)
  const iterator = _await(promise)
  expect(iterator.next()).toEqual({ done: false, value: promise })
  expect(iterator.next(7)).toEqual({ done: true, value: 7 })
  expect(iterator.next()).toEqual({ done: true, value: undefined })
})

test("_await propagates thrown errors and closes on return", () => {
  const iterator = _await(Promise.resolve(1))
  iterator.next()
  const error = new Error("yield rejected")
  expect(() => iterator.throw(error)).toThrow(error)
  expect(iterator.next().done).toBe(true)

  const cancelled = _await(Promise.resolve(1))
  cancelled.next()
  expect(cancelled.return(2)).toEqual({ done: true, value: 2 })
  expect(cancelled.next().done).toBe(true)
})

async function settlement(promise: Promise<unknown>): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise.then(
        (value) => value,
        (error: unknown) => error
      ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve("still pending"), 100)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

test("withGroupFlow rejects when saving the final attached state fails after a yield", async () => {
  const node = toTreeNode({ value: 0 })
  const error = new Error("save failed")
  let failSave = false
  const manager = undoMiddleware(node, undefined, {
    attachedState: {
      save() {
        if (failSave) throw error
      },
      restore() {},
    },
  })
  try {
    const result = manager.withGroupFlow(function* () {
      objectActions.set(node, "value", 1)
      yield Promise.resolve()
      failSave = true
    })
    expect(await settlement(result)).toBe(error)
  } finally {
    manager.dispose()
  }
})

@testModel("FlowErrorModel")
class FlowErrorModel extends Model({ value: prop(0) }) {
  @modelFlow
  run = _async(function* (this: FlowErrorModel, fail: boolean) {
    yield Promise.resolve()
    if (fail) throw new Error("generator failed")
    return 1
  })
}

test.each([ActionContextAsyncStepType.Return, ActionContextAsyncStepType.Throw])(
  "modelFlow rejects when %s middleware throws after a yield",
  async (step) => {
    const node = new FlowErrorModel({})
    const error = new Error("middleware failed")
    const dispose = addActionMiddleware({
      subtreeRoot: node,
      middleware(ctx, next) {
        if (ctx.asyncStepType === step) throw error
        return next()
      },
    })
    try {
      expect(await settlement(node.run(step === ActionContextAsyncStepType.Throw))).toBe(error)
    } finally {
      dispose()
    }
  }
)
