import { action } from "mobx"
import {
  addActionMiddleware,
  applyAction,
  applySnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  newModel,
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
export class P extends Model<{ p2: P2; x: number; arr: number[]; obj: { [k: string]: number } }> {
  defaultData = {
    p2: newModel(P2, {}),
    x: 0,
    arr: [],
    obj: {},
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

  @modelAction
  addNumberToArrAndObj(n: number) {
    this.data.arr.push(n)
    this.data.obj["" + n] = n
  }
}

test("action tracking", () => {
  const events: any = []

  const p = newModel(P, {})

  autoDispose(
    addActionMiddleware({
      target: p,
      middleware(ctx, next) {
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
      },
    })
  )
  expect(events.length).toBe(0)

  const resultX = p.addX(1)
  expect(resultX).toBe(1)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "addX",
          "args": Array [
            1,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
            "data": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 0,
                },
              },
              "x": 1,
            },
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "addX",
          "args": Array [
            1,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
            "data": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 0,
                },
              },
              "x": 1,
            },
          },
          "type": "sync",
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
              "actionName": "addY",
              "args": Array [
                2,
              ],
              "data": Object {},
              "parentContext": undefined,
              "rootContext": [Circular],
              "target": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 2,
                },
              },
              "type": "sync",
            },
            "event": "action started",
          },
          Object {
            "ctx": Object {
              "actionName": "addY",
              "args": Array [
                2,
              ],
              "data": Object {},
              "parentContext": undefined,
              "rootContext": [Circular],
              "target": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 2,
                },
              },
              "type": "sync",
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
          "actionName": "addXY",
          "args": Array [
            1,
            2,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
            "data": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 4,
                },
              },
              "x": 2,
            },
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "addX",
          "args": Array [
            1,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
            "data": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 4,
                },
              },
              "x": 2,
            },
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "addX",
          "args": Array [
            1,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
            "data": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 4,
                },
              },
              "x": 2,
            },
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": 2,
      },
      Object {
        "ctx": Object {
          "actionName": "addY",
          "args": Array [
            2,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "target": P2 {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
            "data": Object {
              "y": 4,
            },
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "addY",
          "args": Array [
            2,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "addXY",
            "args": Array [
              1,
              2,
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P",
              },
              "data": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$$metadata": Object {
                    "id": "mockedUuid-1",
                    "type": "P2",
                  },
                  "data": Object {
                    "y": 4,
                  },
                },
                "x": 2,
              },
            },
            "type": "sync",
          },
          "target": P2 {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
            "data": Object {
              "y": 4,
            },
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": 4,
      },
      Object {
        "ctx": Object {
          "actionName": "addXY",
          "args": Array [
            1,
            2,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
            "data": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
                "data": Object {
                  "y": 4,
                },
              },
              "x": 2,
            },
          },
          "type": "sync",
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

  const p = newModel(P, {})
  autoDispose(
    addActionMiddleware({
      target: p,
      middleware(_ctx, _next) {
        throw err
      },
    })
  )

  const x = p.data.x
  expect(() => p.addX(1)).toThrow(err)
  expect(p.data.x).toBe(x)
})

test("action cancel with new return value", () => {
  const val = 999

  const p = newModel(P, {})
  autoDispose(
    addActionMiddleware({
      target: p,
      middleware(_ctx) {
        return val
      },
    })
  )

  const x = p.data.x
  expect(p.addX(1)).toBe(val)
  expect(p.data.x).toBe(x)
})

test("applyAction", () => {
  const pa = newModel(P, {})
  const pb = newModel(P, {})

  {
    const ra = pa.addX(10)
    const rb = applyAction(pb, {
      targetPath: [],
      actionName: "addX",
      args: [10],
    })
    expect(ra).toBe(rb)
    expect(pa.data.x).toStrictEqual(pb.data.x)
    expect(pa.data.p2.data.y).toStrictEqual(pb.data.p2.data.y)
  }

  {
    const ra = pa.addXY(1, 2)
    const rb = applyAction(pb, {
      targetPath: [],
      actionName: "addXY",
      args: [1, 2],
    })
    expect(ra).toBe(rb)
    expect(pa.data.x).toStrictEqual(pb.data.x)
    expect(pa.data.p2.data.y).toStrictEqual(pb.data.p2.data.y)
  }

  {
    const ra = pa.data.p2.addY(15)
    const rb = applyAction(pb, {
      targetPath: ["data", "p2"],
      actionName: "addY",
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
      targetPath: ["data", "p2"],
      actionName: "$$applySnapshot",
      args: [{ ...getSnapshot(pb.data.p2), y: 100 }],
    })
    expect(pa.data.p2.data.y).toStrictEqual(pb.data.p2.data.y)
  }
})

test("action protection", () => {
  const p = newModel(P, {})

  const err = "data changes must be performed inside model actions"

  expect(() => {
    p.data.x = 100
  }).toThrow(err)

  expect(() => {
    p.data.p2.data.y = 100
  }).toThrow(err)

  expect(
    action(() => {
      p.data.arr.push(100)
    })
  ).toThrow(err)

  expect(
    action(() => {
      p.data.obj["a"] = 100
    })
  ).toThrow(err)

  p.addNumberToArrAndObj(200)

  expect(
    action(() => {
      p.data.arr.splice(0, 1)
    })
  ).toThrow(err)

  expect(
    action(() => {
      delete p.data.obj["200"]
    })
  ).toThrow(err)
})
