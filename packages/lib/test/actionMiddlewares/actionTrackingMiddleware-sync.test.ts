import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  idProp,
  model,
  Model,
  modelAction,
  modelIdKey,
  prop,
  SimpleActionContext,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P2")
export class P2 extends Model({
  [modelIdKey]: idProp,
  y: prop(() => 0),
}) {
  @modelAction
  addY = (n: number) => {
    this.y += n
    return this.y
  }
}

@model("P")
export class P extends Model({
  [modelIdKey]: idProp,
  p2: prop(() => new P2({})),
  x: prop(() => 0),
}) {
  @modelAction
  addX(n: number, _unserializable?: any) {
    this.x += n
    return this.x
  }

  @modelAction
  other(..._any: any[]) {}

  @modelAction
  addXY(n1: number, n2: number) {
    this.addX(n1)
    this.p2.addY(n2)
    return n1 + n2
  }

  @modelAction
  addXY2(n1: number, n2: number) {
    this.addX(n1)
    this.p2.addY(n2)
    return n1 + n2
  }

  @modelAction
  throw(msg: string) {
    throw new Error(msg)
  }
}

test("actionTrackingMiddleware - sync", () => {
  const p1 = new P({})
  const p2 = new P({})

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

  const disposer = actionTrackingMiddleware(p1, {
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

      if (ctx.actionName === "addXY2") {
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
  expect(events).toMatchSnapshot("action on the root")

  // action on the child
  reset()
  p1.p2.addY(2)
  p2.p2.addY(2)
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    Array [
      "addY (filter)",
      "addY (start)",
      "addY (resume)",
      "addY (suspend)",
      "addY (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot("action on the child")

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
  expect(events).toMatchSnapshot("action on the root with sub-action on the child")

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
  expect(events).toMatchSnapshot("throwing")

  // override action on start
  reset()
  const oldX = p1.x
  expect(p1.addXY2(3, 4) === -1000).toBeTruthy() // because of the override on start
  expect(p2.addXY2(3, 4) > 0).toBeTruthy()
  expect(p1.x).toBe(oldX)
  expect(events.map(eventToString)).toMatchInlineSnapshot(`
    Array [
      "addXY2 (filter)",
      "addXY2 (start)",
      "addXY2 (resume)",
      "addXY2 (suspend)",
      "addXY2 (finish - return)",
    ]
  `)
  expect(events).toMatchSnapshot("override action on start")

  // disposing
  reset()
  disposer()
  expect(p1.addXY(5, 6) < 1000).toBeTruthy() // the value override should be gone by now
  expect(p2.addXY(5, 6) < 1000).toBeTruthy()
  expect(events.map(eventToString)).toMatchInlineSnapshot(`Array []`)
  expect(events).toMatchSnapshot("disposing")
})
