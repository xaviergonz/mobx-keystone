import {
  ActionCall,
  ActionContext,
  FlowRet,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelFlow,
  newModel,
  onActionMiddleware,
  prop,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

async function delay(x: number) {
  return new Promise<number>(r => setTimeout(() => r(x), x))
}

@model("P2")
export class P2 extends Model({
  y: prop(() => 0),
}) {
  @modelFlow
  *addY(n: number) {
    this.y += n / 2
    yield delay(50)
    this.y += n / 2
    return this.y
  }
}

@model("P")
export class P extends Model({
  p2: prop(() => newModel(P2, {})),
  x: prop(() => 0),
}) {
  @modelFlow
  *addX(n: number) {
    this.x += n / 2
    const r: FlowRet<typeof delay> = yield delay(50)
    expect(r).toBe(50) // just to see yields return the right result
    this.addXSync(n / 4)
    const r2: FlowRet<typeof delay> = yield delay(40)
    expect(r2).toBe(40) // just to see yields return the right result
    this.x += n / 4
    return this.x
  }

  @modelAction
  addXSync(n: number) {
    this.x += n
    return n
  }

  // as field
  @modelFlow
  addXY = function*(this: P, n1: number, n2: number) {
    const r: FlowRet<typeof this.addX> = yield this.addX(n1)
    expect(typeof r).toBe("number")
    yield delay(50)
    yield this.p2.addY(n2)
    return n1 + n2
  };

  @modelFlow
  *throwFlow(n: number) {
    this.x += n
    yield delay(50)
    throw new Error("flow failed")
  }
}

test("flow", async () => {
  const p = newModel(P, {})

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
  const ret: FlowRet<typeof p.addX> = (await p.addX(2)) as any
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
          "targetId": "mockedUuid-1",
          "targetPath": Array [],
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
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
              },
              "x": 2,
            },
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
          },
          "type": "async",
        },
      },
    ]
  `)

  reset()
  const ret2: FlowRet<typeof p.addXY> = (await p.addXY(4, 4)) as any
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
          "targetId": "mockedUuid-1",
          "targetPath": Array [],
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
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
              },
              "x": 6,
            },
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
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
          "targetId": "mockedUuid-1",
          "targetPath": Array [],
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
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
              },
              "x": 16,
            },
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
          },
          "type": "async",
        },
      },
    ]
  `)
})
