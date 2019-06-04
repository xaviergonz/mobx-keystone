import {
  addActionMiddleware,
  applyAction,
  applySnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
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
  addX(n: number) {
    this.data.x += n
    return this.data.x
  }

  @modelAction
  addXY(n1: number, n2: number) {
    this.addX(n1)
    this.data.p2.addY(n2)
    return n1 + n2
  }
}

test("action tracking", () => {
  const events: any = []

  autoDispose(
    addActionMiddleware((ctx, next) => {
      events.push({
        event: "action started",
        ctx,
      })
      const result = next()
      events.push({
        event: "action finished",
        ctx,
        result,
      })
      return result
    })
  )

  const p = new P()
  expect(events.length).toBe(0)

  const resultX = p.addX(1)
  expect(resultX).toBe(1)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
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
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
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
        },
        "event": "action finished",
        "result": 1,
      },
    ]
  `)
  events.length = 0

  const resultY = p.data.p2.addY(2)
  expect(resultY).toBe(2)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
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
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
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
        },
        "event": "action finished",
        "result": 2,
      },
    ]
  `)
  events.length = 0

  const resultXY = p.addXY(1, 2)
  expect(resultXY).toBe(1 + 2)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "args": Array [
            1,
            2,
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
                  "y": 4,
                },
              },
              "x": 2,
            },
          },
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "args": Array [
            1,
          ],
          "data": Object {},
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              1,
              2,
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
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
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
              "x": 2,
            },
          },
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "args": Array [
            1,
          ],
          "data": Object {},
          "name": "addX",
          "parentContext": Object {
            "args": Array [
              1,
              2,
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
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
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
              "x": 2,
            },
          },
        },
        "event": "action finished",
        "result": 2,
      },
      Object {
        "ctx": Object {
          "args": Array [
            2,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              1,
              2,
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
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 4,
            },
          },
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "args": Array [
            2,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": Object {
            "args": Array [
              1,
              2,
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
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
          },
          "target": P2 {
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 4,
            },
          },
        },
        "event": "action finished",
        "result": 4,
      },
      Object {
        "ctx": Object {
          "args": Array [
            1,
            2,
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
                  "y": 4,
                },
              },
              "x": 2,
            },
          },
        },
        "event": "action finished",
        "result": 3,
      },
    ]
  `)
  events.length = 0
})

test("action cancel with error", () => {
  const err = new Error("someError")

  autoDispose(
    addActionMiddleware((_ctx, _next) => {
      throw err
    })
  )

  const p = new P()
  const x = p.data.x
  expect(() => p.addX(1)).toThrow(err)
  expect(p.data.x).toBe(x)
})

test("action cancel with new return value", () => {
  const val = 999

  autoDispose(
    addActionMiddleware(_ctx => {
      return val
    })
  )

  const p = new P()
  const x = p.data.x
  expect(p.addX(1)).toBe(val)
  expect(p.data.x).toBe(x)
})

test("applyAction", () => {
  const pa = new P()
  const pb = new P()

  {
    const ra = pa.addX(10)
    const rb = applyAction(pb, {
      path: [],
      name: "addX",
      args: [10],
    })
    expect(ra).toBe(rb)
    expect(pa.data.x).toStrictEqual(pb.data.x)
    expect(pa.data.p2.data.y).toStrictEqual(pb.data.p2.data.y)
  }

  {
    const ra = pa.addXY(1, 2)
    const rb = applyAction(pb, {
      path: [],
      name: "addXY",
      args: [1, 2],
    })
    expect(ra).toBe(rb)
    expect(pa.data.x).toStrictEqual(pb.data.x)
    expect(pa.data.p2.data.y).toStrictEqual(pb.data.p2.data.y)
  }

  {
    const ra = pa.data.p2.addY(15)
    const rb = applyAction(pb, {
      path: ["data", "p2"],
      name: "addY",
      args: [15],
    })
    expect(ra).toBe(rb)
    expect(pa.data.x).toStrictEqual(pb.data.x)
    expect(pa.data.p2.data.y).toStrictEqual(pb.data.p2.data.y)
  }

  {
    applySnapshot(pa.data.p2, {
      ...getSnapshot(pa.data.p2),
      y: 100,
    })
    applyAction(pb, {
      path: ["data", "p2"],
      name: "$$applySnapshot",
      args: [{ ...getSnapshot(pb.data.p2), y: 100 }],
    })
    expect(pa.data.p2.data.y).toStrictEqual(pb.data.p2.data.y)
  }
})
