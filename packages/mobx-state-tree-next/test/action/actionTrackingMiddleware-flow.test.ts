import {
  actionTrackingMiddleware,
  ActionTrackingResult,
  addActionMiddleware,
  FlowRet,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelFlow,
  SimpleActionContext,
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

test("actionTrackingMiddleware - flow", async () => {
  const p = new P()

  const events: {
    type: "filter" | "start" | "finish"
    result?: ActionTrackingResult
    value?: any
    context: SimpleActionContext
  }[] = []
  function reset() {
    events.length = 0
  }

  const actTracker = actionTrackingMiddleware(
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
      onFinish(ctx, result, value) {
        events.push({
          type: "finish",
          result,
          value,
          context: ctx,
        })
      },
    }
  )
  const disposer = addActionMiddleware(actTracker)
  autoDispose(disposer)

  reset()
  const ret: FlowRet<typeof p.addX> = (await p.addX(2)) as any
  expect(ret).toBe(2)
  expect(p.data.x).toBe(2)
  expect(getSnapshot(p).x).toBe(2)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "context": Object {
          "args": Array [
            2,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addX",
          "parentContext": undefined,
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
          "type": "async",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            2,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addX",
          "parentContext": undefined,
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
          "type": "async",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            0.5,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXSync",
          "parentContext": Object {
            "args": Array [
              2,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addX",
            "parentContext": undefined,
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
            "type": "async",
          },
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
          "type": "sync",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            0.5,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXSync",
          "parentContext": Object {
            "args": Array [
              2,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addX",
            "parentContext": undefined,
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
            "type": "async",
          },
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
          "type": "sync",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            0.5,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXSync",
          "parentContext": Object {
            "args": Array [
              2,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addX",
            "parentContext": undefined,
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
            "type": "async",
          },
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
          "type": "sync",
        },
        "result": "return",
        "type": "finish",
        "value": 0.5,
      },
      Object {
        "context": Object {
          "args": Array [
            2,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addX",
          "parentContext": undefined,
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
          "type": "async",
        },
        "result": "return",
        "type": "finish",
        "value": 2,
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
        "context": Object {
          "args": Array [
            4,
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXY",
          "parentContext": undefined,
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
          "type": "async",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            4,
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXY",
          "parentContext": undefined,
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
          "type": "async",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              4,
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addXY",
            "parentContext": undefined,
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
            "type": "async",
          },
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
          "type": "async",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              4,
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addXY",
            "parentContext": undefined,
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
            "type": "async",
          },
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
          "type": "async",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            1,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXSync",
          "parentContext": Object {
            "args": Array [
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addX",
            "parentContext": Object {
              "args": Array [
                4,
                4,
              ],
              "data": Object {
                Symbol(actionTrackingMiddlewareFilterAccepted): true,
              },
              "name": "addXY",
              "parentContext": undefined,
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
              "type": "async",
            },
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
            "type": "async",
          },
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
          "type": "sync",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            1,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXSync",
          "parentContext": Object {
            "args": Array [
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addX",
            "parentContext": Object {
              "args": Array [
                4,
                4,
              ],
              "data": Object {
                Symbol(actionTrackingMiddlewareFilterAccepted): true,
              },
              "name": "addXY",
              "parentContext": undefined,
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
              "type": "async",
            },
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
            "type": "async",
          },
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
          "type": "sync",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            1,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXSync",
          "parentContext": Object {
            "args": Array [
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addX",
            "parentContext": Object {
              "args": Array [
                4,
                4,
              ],
              "data": Object {
                Symbol(actionTrackingMiddlewareFilterAccepted): true,
              },
              "name": "addXY",
              "parentContext": undefined,
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
              "type": "async",
            },
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
            "type": "async",
          },
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
          "type": "sync",
        },
        "result": "return",
        "type": "finish",
        "value": 1,
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              4,
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addXY",
            "parentContext": undefined,
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
            "type": "async",
          },
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
          "type": "async",
        },
        "result": "return",
        "type": "finish",
        "value": 6,
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              4,
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addXY",
            "parentContext": undefined,
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
            "type": "async",
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 4,
            },
          },
          "type": "async",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              4,
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addXY",
            "parentContext": undefined,
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
            "type": "async",
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 4,
            },
          },
          "type": "async",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              4,
              4,
            ],
            "data": Object {
              Symbol(actionTrackingMiddlewareFilterAccepted): true,
            },
            "name": "addXY",
            "parentContext": undefined,
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
            "type": "async",
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 4,
            },
          },
          "type": "async",
        },
        "result": "return",
        "type": "finish",
        "value": 4,
      },
      Object {
        "context": Object {
          "args": Array [
            4,
            4,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "addXY",
          "parentContext": undefined,
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
          "type": "async",
        },
        "result": "return",
        "type": "finish",
        "value": 8,
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
        "context": Object {
          "args": Array [
            10,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "throwFlow",
          "parentContext": undefined,
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
          "type": "async",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            10,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "throwFlow",
          "parentContext": undefined,
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
          "type": "async",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            10,
          ],
          "data": Object {
            Symbol(actionTrackingMiddlewareFilterAccepted): true,
          },
          "name": "throwFlow",
          "parentContext": undefined,
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
          "type": "async",
        },
        "result": "throw",
        "type": "finish",
        "value": [Error: flow failed],
      },
    ]
  `)

  // disposing
  reset()
  disposer()
  p.addXY(5, 6)
  expect(events).toMatchInlineSnapshot(`Array []`)
})
