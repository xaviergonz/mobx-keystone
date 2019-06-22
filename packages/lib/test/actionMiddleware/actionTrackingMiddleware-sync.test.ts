import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  model,
  Model,
  modelAction,
  newModel,
  SimpleActionContext,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P2")
export class P2 extends Model<{ y: number }> {
  defaultData = {
    y: 0,
  }

  @modelAction
  addY = (n: number) => {
    this.data.y += n
    return this.data.y
  }
}

@model("P")
export class P extends Model<{ p2: P2; x: number }> {
  defaultData = {
    p2: newModel(P2, {}),
    x: 0,
  }

  @modelAction
  addX(n: number, _unserializable?: any) {
    this.data.x += n
    return this.data.x
  }

  @modelAction
  other(..._any: any[]) {}

  @modelAction
  addXY(n1: number, n2: number) {
    this.addX(n1)
    this.data.p2.addY(n2)
    return n1 + n2
  }

  @modelAction
  throw(msg: string) {
    throw new Error(msg)
  }
}

test("actionTrackingMiddleware - sync", () => {
  const p1 = newModel(P, {})
  const p2 = newModel(P, {})

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
      str = `${current.actionName}` + " > " + str
      current = current.parentContext
    }
    return str
  }

  const events: Event[] = []
  function reset() {
    events.length = 0
  }

  const disposer = actionTrackingMiddleware(
    { model: p1 },
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

        if (ctx.actionName === "addXY") {
          overrideValue(value + 1000)
        }
      },
    }
  )
  autoDispose(disposer)

  // action on the root
  p1.addX(1)
  p2.addX(1)
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    Array [
      "addX (filter)",
      "addX (start)",
      "addX (resume)",
      "addX (suspend)",
      "addX (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot()

  // action on the child
  reset()
  p1.data.p2.addY(2)
  p2.data.p2.addY(2)
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    Array [
      "addY (filter)",
      "addY (start)",
      "addY (resume)",
      "addY (suspend)",
      "addY (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot()

  // action on the root with sub-action on the child
  reset()
  expect(p1.addXY(3, 4) > 1000).toBeTruthy() // because of the return value override
  expect(p2.addXY(3, 4) < 1000).toBeTruthy()
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    Array [
      "addXY (filter)",
      "addXY (start)",
      "addXY (resume)",
      "addXY > addX (filter)",
      "addXY > addX (start)",
      "addXY > addX (resume)",
      "addXY > addX (suspend)",
      "addXY > addX (finish - return)",
      "addXY > addY (filter)",
      "addXY > addY (start)",
      "addXY > addY (resume)",
      "addXY > addY (suspend)",
      "addXY > addY (finish - return)",
      "addXY (suspend)",
      "addXY (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot()

  // throwing
  reset()
  expect(() => p1.throw("some error")).toThrow("some error")
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    Array [
      "throw (filter)",
      "throw (start)",
      "throw (resume)",
      "throw (suspend)",
      "throw (finish - throw)",
    ]
  `)
  expect(events).toMatchSnapshot()

  // disposing
  reset()
  disposer()
  expect(p1.addXY(5, 6) < 1000).toBeTruthy() // the value override should be gone by now
  expect(p2.addXY(5, 6) < 1000).toBeTruthy()
  expect(events.map(eventToString)).toMatchInlineSnapshot(`Array []`)
  expect(events).toMatchSnapshot()
})
