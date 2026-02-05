import { _, assert } from "spec.ts"
import {
  _async,
  _await,
  ActionCall,
  ActionContext,
  ExtendedModel,
  getSnapshot,
  Model,
  modelAction,
  modelFlow,
  onActionMiddleware,
  prop,
} from "../../src"
import { autoDispose, delay, testModel } from "../utils"

@testModel("P2")
class P2 extends Model({
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

@testModel("P")
class P extends Model({
  p2: prop(() => new P2({})),
  x: prop(() => 0),
}) {
  @modelFlow
  addX = _async(function* (this: P, n: number) {
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
    [
      {
        "actionCall": {
          "actionName": "addX",
          "args": [
            2,
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        "context": {
          "actionName": "addX",
          "args": [
            2,
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "p2": P2 {
                "$": {
                  "y": 0,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 2,
            },
            "$modelType": "P",
            "addX": [Function],
            "addXY": [Function],
            "throwFlow": [Function],
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
    [
      {
        "actionCall": {
          "actionName": "addXY",
          "args": [
            4,
            4,
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        "context": {
          "actionName": "addXY",
          "args": [
            4,
            4,
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "p2": P2 {
                "$": {
                  "y": 4,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 6,
            },
            "$modelType": "P",
            "addX": [Function],
            "addXY": [Function],
            "throwFlow": [Function],
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
    expect.fail("flow must throw")
  } catch (err: any) {
    expect(err.message).toBe("flow failed")
  } finally {
    expect(p.x).toBe(oldX + 10)
  }
  expect(events).toMatchInlineSnapshot(`
    [
      {
        "actionCall": {
          "actionName": "throwFlow",
          "args": [
            10,
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        "context": {
          "actionName": "throwFlow",
          "args": [
            10,
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "p2": P2 {
                "$": {
                  "y": 4,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 16,
            },
            "$modelType": "P",
            "addX": [Function],
            "addXY": [Function],
            "throwFlow": [Function],
          },
          "type": "async",
        },
      },
    ]
  `)
})

test("arrow model flows work when destructured", async () => {
  @testModel("M")
  class M extends Model({
    x: prop(0),
  }) {
    private *_addX(n: number) {
      this.x += n
      yield* _await(Promise.resolve())
      this.x += n
      return this.x
    }

    @modelFlow
    addX = _async(this._addX)
  }

  {
    const m = new M({})
    expect(await m.addX(1)).toBe(2)
    const { addX } = m
    expect(await addX(1)).toBe(4)
  }

  @testModel("M2")
  class M2 extends ExtendedModel(M, {}) {}

  {
    const m2 = new M2({})
    expect(await m2.addX(1)).toBe(2)
    const { addX } = m2
    expect(await addX(1)).toBe(4)
  }
})
