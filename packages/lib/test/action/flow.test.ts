import { assert, _ } from "spec.ts"
import {
  ActionCall,
  ActionContext,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelFlow,
  onActionMiddleware,
  prop,
  _async,
  _await,
} from "../../src"
import "../commonSetup"
import { autoDispose, delay } from "../utils"

@model("P2")
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
}

@model("P")
export class P extends Model({
  p2: prop(() => new P2({})),
  x: prop(() => 0),
}) {
  @modelFlow
  addX = _async(function*(this: P, n: number) {
    this.x += n / 2
    const r = yield* _await(delay(50))
    assert(r, _ as number)
    expect(r).toBe(50) // just to see yields return the right result
    this.addXSync(n / 4)
    const r2 = yield* _await(delay(40))
    assert(r2, _ as number)
    expect(r2).toBe(40) // just to see yields return the right result
    this.x += n / 4
    return this.x
  })

  @modelAction
  addXSync(n: number) {
    this.x += n
    return n
  }

  @modelFlow
  addXY = _async(this._addXY)

  private *_addXY(n1: number, n2: number) {
    const r = yield* _await(this.addX(n1))
    assert(r, _ as number)
    expect(typeof r).toBe("number")
    yield* _await(delay(50))
    yield* _await(this.p2.addY(n2))
    return n1 + n2
  }

  @modelFlow
  throwFlow = _async(this._throwFlow)

  private *_throwFlow(n: number) {
    this.x += n
    yield* _await(delay(50))
    throw new Error("flow failed")
  }
}

test("flow", async () => {
  const p = new P({})

  interface Event {
    actionCall: ActionCall
    context: ActionContext
  }

  const events: Event[] = []
  function reset() {
    events.length = 0
  }

  const disposer = onActionMiddleware(p, {
    onStart(actionCall, context) {
      events.push({
        actionCall,
        context,
      })
    },
  })
  autoDispose(disposer)

  reset()
  const ret = await p.addX(2)
  assert(ret, _ as number)
  expect(ret).toBe(2)
  expect(p.x).toBe(2)
  expect(getSnapshot(p).x).toBe(2)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionCall": Object {
          "actionName": "addX",
          "args": Array [
            2,
          ],
          "targetPath": Array [],
          "targetPathIds": Array [],
        },
        "context": Object {
          "actionName": "addX",
          "args": Array [
            2,
          ],
          "data": Object {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): Object {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "p2": P2 {
                "$": Object {
                  "y": 0,
                },
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 2,
            },
            "$modelId": "id-1",
            "$modelType": "P",
          },
          "type": "async",
        },
      },
    ]
  `)

  reset()
  const ret2 = await p.addXY(4, 4)
  assert(ret2, _ as number)
  expect(ret2).toBe(8)
  expect(p.x).toBe(6)
  expect(p.p2.y).toBe(4)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionCall": Object {
          "actionName": "addXY",
          "args": Array [
            4,
            4,
          ],
          "targetPath": Array [],
          "targetPathIds": Array [],
        },
        "context": Object {
          "actionName": "addXY",
          "args": Array [
            4,
            4,
          ],
          "data": Object {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): Object {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "p2": P2 {
                "$": Object {
                  "y": 4,
                },
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 6,
            },
            "$modelId": "id-1",
            "$modelType": "P",
          },
          "type": "async",
        },
      },
    ]
  `)

  // check rejection
  reset()
  const oldX = p.x
  try {
    await p.throwFlow(10)
    fail("flow must throw")
  } catch (err) {
    expect(err.message).toBe("flow failed")
  } finally {
    expect(p.x).toBe(oldX + 10)
  }
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionCall": Object {
          "actionName": "throwFlow",
          "args": Array [
            10,
          ],
          "targetPath": Array [],
          "targetPathIds": Array [],
        },
        "context": Object {
          "actionName": "throwFlow",
          "args": Array [
            10,
          ],
          "data": Object {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): Object {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "p2": P2 {
                "$": Object {
                  "y": 4,
                },
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 16,
            },
            "$modelId": "id-1",
            "$modelType": "P",
          },
          "type": "async",
        },
      },
    ]
  `)
})
