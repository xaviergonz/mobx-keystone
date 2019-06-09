import {
  ActionContext,
  FlowRet,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelFlow,
  onAction,
  SerializableActionCall,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../withDisposers"

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

test("flow", async () => {
  const p = new P()

  const events: {
    serializableActionCall: SerializableActionCall
    actionContext: ActionContext
  }[] = []
  function reset() {
    events.length = 0
  }

  const disposer = onAction(p, (serAct, ctx, next) => {
    events.push({
      serializableActionCall: serAct,
      actionContext: ctx,
    })
    let ret = next()
    return ret
  })
  autoDispose(disposer)

  reset()
  const ret: FlowRet<typeof p.addX> = (await p.addX(2)) as any
  expect(ret).toBe(2)
  expect(p.data.x).toBe(2)
  expect(getSnapshot(p).x).toBe(2)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionContext": Object {
          "args": Array [
            2,
          ],
          "asyncStepType": "spawn",
          "data": Object {},
          "name": "addX",
          "parentContext": undefined,
          "previousAsyncStepContext": undefined,
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 0,
                },
              },
              "x": 2,
            },
          },
        },
        "serializableActionCall": Object {
          "args": Array [
            2,
          ],
          "name": "addX",
          "path": Array [],
        },
      },
    ]
  `)

  reset()
  const ret2: FlowRet<typeof p.addXY> = (await p.addXY(4, 4)) as any
  expect(ret2).toBe(8)
  expect(p.data.x).toBe(6)
  expect(p.data.p2.data.y).toBe(4)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionContext": Object {
          "args": Array [
            4,
            4,
          ],
          "asyncStepType": "spawn",
          "data": Object {},
          "name": "addXY",
          "parentContext": undefined,
          "previousAsyncStepContext": undefined,
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 4,
                },
              },
              "x": 6,
            },
          },
        },
        "serializableActionCall": Object {
          "args": Array [
            4,
            4,
          ],
          "name": "addXY",
          "path": Array [],
        },
      },
    ]
  `)

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
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionContext": Object {
          "args": Array [
            10,
          ],
          "asyncStepType": "spawn",
          "data": Object {},
          "name": "throwFlow",
          "parentContext": undefined,
          "previousAsyncStepContext": undefined,
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 4,
                },
              },
              "x": 16,
            },
          },
        },
        "serializableActionCall": Object {
          "args": Array [
            10,
          ],
          "name": "throwFlow",
          "path": Array [],
        },
      },
    ]
  `)
})
