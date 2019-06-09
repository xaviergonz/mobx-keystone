import {
  ActionTrackingMiddlewareResult,
  addActionTrackingMiddleware,
  model,
  Model,
  modelAction,
  SimpleActionContext,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../withDisposers"

@model("P2")
export class P2 extends Model {
  data = {
    y: 0,
  }

  @modelAction
  addY = (n: number) => {
    this.data.y += n
    return this.data.y
  }
}

@model("P")
export class P extends Model {
  data = {
    p2: new P2(),
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

test("addActionTrackingMiddleware - sync", () => {
  const p1 = new P()
  const p2 = new P()

  const events: {
    type: "filter" | "start" | "finish"
    result?: ActionTrackingMiddlewareResult
    value?: any
    context: SimpleActionContext
  }[] = []
  function reset() {
    events.length = 0
  }

  const disposer = addActionTrackingMiddleware(p1, {
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
  })
  autoDispose(disposer)

  // action on the root
  p1.addX(1)
  p2.addX(1)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "context": Object {
          "args": Array [
            1,
          ],
          "data": Object {},
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
              "x": 1,
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
          "data": Object {},
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
              "x": 1,
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
          "data": Object {},
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
              "x": 1,
            },
          },
          "type": "sync",
        },
        "result": "return",
        "type": "finish",
        "value": 1,
      },
    ]
  `)

  // action on the child
  reset()
  p1.data.p2.addY(2)
  p2.data.p2.addY(2)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "context": Object {
          "args": Array [
            2,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": undefined,
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 2,
            },
          },
          "type": "sync",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            2,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": undefined,
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 2,
            },
          },
          "type": "sync",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            2,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": undefined,
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 2,
            },
          },
          "type": "sync",
        },
        "result": "return",
        "type": "finish",
        "value": 2,
      },
    ]
  `)

  // action on the root with sub-action on the child
  reset()
  p1.addXY(3, 4)
  p2.addXY(3, 4)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "context": Object {
          "args": Array [
            3,
            4,
          ],
          "data": Object {},
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
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            3,
            4,
          ],
          "data": Object {},
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
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            3,
          ],
          "data": Object {},
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              3,
              4,
            ],
            "data": Object {},
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
                    "y": 6,
                  },
                },
                "x": 4,
              },
            },
            "type": "sync",
          },
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            3,
          ],
          "data": Object {},
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              3,
              4,
            ],
            "data": Object {},
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
                    "y": 6,
                  },
                },
                "x": 4,
              },
            },
            "type": "sync",
          },
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            3,
          ],
          "data": Object {},
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              3,
              4,
            ],
            "data": Object {},
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
                    "y": 6,
                  },
                },
                "x": 4,
              },
            },
            "type": "sync",
          },
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "result": "return",
        "type": "finish",
        "value": 4,
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              3,
              4,
            ],
            "data": Object {},
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
                    "y": 6,
                  },
                },
                "x": 4,
              },
            },
            "type": "sync",
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 6,
            },
          },
          "type": "sync",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              3,
              4,
            ],
            "data": Object {},
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
                    "y": 6,
                  },
                },
                "x": 4,
              },
            },
            "type": "sync",
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 6,
            },
          },
          "type": "sync",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            4,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              3,
              4,
            ],
            "data": Object {},
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
                    "y": 6,
                  },
                },
                "x": 4,
              },
            },
            "type": "sync",
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 6,
            },
          },
          "type": "sync",
        },
        "result": "return",
        "type": "finish",
        "value": 6,
      },
      Object {
        "context": Object {
          "args": Array [
            3,
            4,
          ],
          "data": Object {},
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
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "result": "return",
        "type": "finish",
        "value": 7,
      },
    ]
  `)

  // throwing
  reset()
  expect(() => p1.throw("some error")).toThrow("some error")
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "context": Object {
          "args": Array [
            "some error",
          ],
          "data": Object {},
          "name": "throw",
          "parentContext": undefined,
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "type": "filter",
      },
      Object {
        "context": Object {
          "args": Array [
            "some error",
          ],
          "data": Object {},
          "name": "throw",
          "parentContext": undefined,
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "type": "start",
      },
      Object {
        "context": Object {
          "args": Array [
            "some error",
          ],
          "data": Object {},
          "name": "throw",
          "parentContext": undefined,
          "target": P {
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
        "result": "throw",
        "type": "finish",
        "value": [Error: some error],
      },
    ]
  `)

  // disposing
  reset()
  disposer()
  p1.addXY(5, 6)
  p2.addXY(5, 6)
  expect(events).toMatchInlineSnapshot(`Array []`)
})
