import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  FlowRet,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelFlow,
  SimpleActionContext,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

async function delay(x: number) {
  return new Promise<number>(r => setTimeout(() => r(x), x))
}

@model("P2")
export class P2 extends Model {
  data = {
    y: 0,
  };

  @modelFlow
  *addY(n: number) {
    this.data.y += n / 2
    yield delay(50)
    this.data.y += n / 2
    return this.data.y
  }
}

@model("P")
export class P extends Model {
  data = {
    p2: new P2(),
    x: 0,
  };

  @modelFlow
  *addX(n: number) {
    this.data.x += n / 2
    const r: FlowRet<typeof delay> = yield delay(50)
    expect(r).toBe(50) // just to see yields return the right result
    this.addXSync(n / 4)
    const r2: FlowRet<typeof delay> = yield delay(40)
    expect(r2).toBe(40) // just to see yields return the right result
    this.data.x += n / 4
    return this.data.x
  }

  @modelAction
  addXSync(n: number) {
    this.data.x += n
    return n
  }

  // as field
  @modelFlow
  addXY = function*(this: P, n1: number, n2: number) {
    const r: FlowRet<typeof this.addX> = yield this.addX(n1)
    expect(typeof r).toBe("number")
    yield delay(50)
    yield this.data.p2.addY(n2)
    return n1 + n2
  };

  @modelFlow
  *throwFlow(n: number) {
    this.data.x += n
    yield delay(50)
    throw new Error("flow failed")
  }
}

test("actionTrackingMiddleware - flow", async () => {
  const p = new P()

  interface Event {
    type: "filter" | "start" | "finish" | "resume" | "suspend"
    result?: ActionTrackingResult
    value?: any
    context: SimpleActionContext
  }

  function eventToString(ev: Event) {
    let str = `${ev.context.name} (${ev.type}${ev.result ? " - " + ev.result : ""})`
    let current = ev.context.parentContext
    while (current) {
      str = `${current.name}` + " > " + str
      current = current.parentContext
    }
    return str
  }

  const events: Event[] = []
  function reset() {
    events.length = 0
  }

  const disposer = actionTrackingMiddleware(
    { model: p },
    {
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
      onFinish(ctx, result, value, overrideValue) {
        events.push({
          type: "finish",
          result,
          value,
          context: ctx,
        })
        if (ctx.name === "addXY") {
          overrideValue(value + 1000)
        }
      },
    }
  )
  autoDispose(disposer)

  reset()
  const ret: FlowRet<typeof p.addX> = (await p.addX(2)) as any
  expect(ret).toBe(2)
  expect(p.data.x).toBe(2)
  expect(getSnapshot(p).x).toBe(2)

  expect(events.map(eventToString)).toMatchInlineSnapshot(`
            Array [
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
  expect(events).toMatchSnapshot()

  reset()
  const ret2: FlowRet<typeof p.addXY> = (await p.addXY(4, 4)) as any
  expect(ret2).toBe(8 + 1000) // +1000 because of the return value override
  expect(p.data.x).toBe(6)
  expect(p.data.p2.data.y).toBe(4)

  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    Array [
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
  expect(events).toMatchSnapshot()

  // check rejection
  reset()
  const oldX = p.data.x
  try {
    await p.throwFlow(10)
    fail("flow must throw")
  } catch (err) {
    expect(err.message).toBe("flow failed")
  } finally {
    expect(p.data.x).toBe(oldX + 10)
  }
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
            Array [
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
  expect(events).toMatchSnapshot()

  // disposing
  reset()
  disposer()
  const ret3: FlowRet<typeof p.addXY> = (await p.addXY(5, 6)) as any
  expect(ret3 < 1000).toBeTruthy() // the return value override should be gone by now
  expect(events.map(eventToString)).toMatchInlineSnapshot(`Array []`)
  expect(events).toMatchSnapshot()
})
