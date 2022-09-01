import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  getSnapshot,
  Model,
  modelAction,
  modelFlow,
  prop,
  SimpleActionContext,
  _async,
  _await,
} from "../../src"
import { autoDispose, delay, testModel } from "../utils"

@testModel("P2")
export class P2 extends Model({
  y: prop(() => 0),
}) {
  private *_addY(n: number) {
    this.y += n / 2
    yield* _await(delay(50))
    this.y += n / 2
    return this.y
  }

  @modelFlow
  addY = _async(this._addY)

  private *_addY2(n: number) {
    this.y += n / 2
    yield* _await(delay(50))
    this.y += n / 2
    return this.y
  }

  @modelFlow
  addY2 = _async(this._addY2)
}

@testModel("P")
export class P extends Model({
  p2: prop(() => new P2({})),
  x: prop(() => 0),
}) {
  private *_addX(n: number) {
    this.x += n / 2
    const r = yield* _await(delay(50))
    expect(r).toBe(50) // just to see yields return the right result
    this.addXSync(n / 4)
    const r2 = yield* _await(delay(40))
    expect(r2).toBe(40) // just to see yields return the right result
    this.x += n / 4
    return this.x
  }

  @modelFlow
  addX = _async(this._addX)

  @modelAction
  addXSync(n: number) {
    this.x += n
    return n
  }

  private *_addXY(n1: number, n2: number) {
    const r = yield* _await(this.addX(n1))
    expect(typeof r).toBe("number")
    yield* _await(delay(50))
    yield* _await(this.p2.addY(n2))
    return n1 + n2
  }

  @modelFlow
  addXY = _async(this._addXY)

  private *_throwFlow(n: number) {
    this.x += n
    yield* _await(delay(50))
    throw new Error("flow failed")
  }

  @modelFlow
  throwFlow = _async(this._throwFlow)
}

test("actionTrackingMiddleware - flow", async () => {
  const p = new P({})

  interface Event {
    type: "filter" | "start" | "finish" | "resume" | "suspend"
    result?: ActionTrackingResult
    value?: any
    context: SimpleActionContext
  }

  function eventToString(ev: Event) {
    let str = `${ev.context.actionName} (${ev.type}${ev.result ? " - " + ev.result : ""})`
    let current = ev.context.parentContext
    while (current) {
      str = `${current.actionName} > ${str}`
      current = current.parentContext
    }
    return str
  }

  const events: Event[] = []
  function reset() {
    events.length = 0
  }

  const disposer = actionTrackingMiddleware(p, {
    filter(ctx) {
      events.push({
        type: "filter",
        context: ctx,
      })
      return true
    },
    onStart(ctx) {
      events.push({
        type: "start",
        context: ctx,
      })

      if (ctx.actionName === "addY2") {
        return {
          result: ActionTrackingResult.Return,
          value: -1000,
        }
      }
      return undefined
    },
    onResume(ctx) {
      events.push({
        type: "resume",
        context: ctx,
      })
    },
    onSuspend(ctx) {
      events.push({
        type: "suspend",
        context: ctx,
      })
    },
    onFinish(ctx, ret) {
      events.push({
        type: "finish",
        result: ret.result,
        value: ret.value,
        context: ctx,
      })
      if (ctx.actionName === "addXY") {
        return {
          result: ActionTrackingResult.Return,
          value: ret.value + 1000,
        }
      }
      return undefined
    },
  })
  autoDispose(disposer)

  reset()
  const ret = await p.addX(2)
  expect(ret).toBe(2)
  expect(p.x).toBe(2)
  expect(getSnapshot(p).x).toBe(2)

  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    [
      "addX (filter)",
      "addX (start)",
      "addX (resume)",
      "addX (suspend)",
      "addX (resume)",
      "addX (suspend)",
      "addX (resume)",
      "addX > addXSync (filter)",
      "addX > addXSync (start)",
      "addX > addXSync (resume)",
      "addX > addXSync (suspend)",
      "addX > addXSync (finish - return)",
      "addX (suspend)",
      "addX (resume)",
      "addX (suspend)",
      "addX (resume)",
      "addX (suspend)",
      "addX (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot("addX")

  reset()
  const ret2 = await p.addXY(4, 4)
  expect(ret2).toBe(8 + 1000) // +1000 because of the return value override
  expect(p.x).toBe(6)
  expect(p.p2.y).toBe(4)

  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    [
      "addXY (filter)",
      "addXY (start)",
      "addXY (resume)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addX (filter)",
      "addXY > addX (start)",
      "addXY > addX (resume)",
      "addXY > addX (suspend)",
      "addXY > addX (resume)",
      "addXY > addX (suspend)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addX (resume)",
      "addXY > addX > addXSync (filter)",
      "addXY > addX > addXSync (start)",
      "addXY > addX > addXSync (resume)",
      "addXY > addX > addXSync (suspend)",
      "addXY > addX > addXSync (finish - return)",
      "addXY > addX (suspend)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addX (resume)",
      "addXY > addX (suspend)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addX (resume)",
      "addXY > addX (suspend)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addX (finish - return)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addY (filter)",
      "addXY > addY (start)",
      "addXY > addY (resume)",
      "addXY > addY (suspend)",
      "addXY > addY (resume)",
      "addXY > addY (suspend)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addY (resume)",
      "addXY > addY (suspend)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addY (resume)",
      "addXY > addY (suspend)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY > addY (finish - return)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY (suspend)",
      "addXY (resume)",
      "addXY (suspend)",
      "addXY (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot("addXY")

  // check rejection
  reset()
  const oldX = p.x
  try {
    await p.throwFlow(10)
    fail("flow must throw")
  } catch (err: any) {
    expect(err.message).toBe("flow failed")
  } finally {
    expect(p.x).toBe(oldX + 10)
  }
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    [
      "throwFlow (filter)",
      "throwFlow (start)",
      "throwFlow (resume)",
      "throwFlow (suspend)",
      "throwFlow (resume)",
      "throwFlow (suspend)",
      "throwFlow (resume)",
      "throwFlow (suspend)",
      "throwFlow (resume)",
      "throwFlow (suspend)",
      "throwFlow (finish - throw)",
    ]
  `)
  expect(events).toMatchSnapshot("throwFlow")

  // overriding flow start
  reset()
  const oldY = p.p2.y
  const retOverrideStart = await p.p2.addY2(10)
  await delay(100) // just to make sure the promise didn't change data on its own
  expect(p.p2.y).toBe(oldY)
  expect(retOverrideStart).toBe(-1000)
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    [
      "addY2 (filter)",
      "addY2 (start)",
      "addY2 (resume)",
      "addY2 (suspend)",
      "addY2 (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot("overriding flow start")

  // disposing
  reset()
  disposer()
  const ret3 = await p.addXY(5, 6)
  expect(ret3 < 1000).toBeTruthy() // the return value override should be gone by now
  expect(events.map(eventToString)).toMatchInlineSnapshot(`[]`)
  expect(events).toMatchSnapshot("disposing")
})
