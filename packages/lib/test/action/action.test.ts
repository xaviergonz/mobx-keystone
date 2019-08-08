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
  prop,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P2")
export class P2 extends Model({
  y: prop(0),
}) {
  @modelAction
  addY = (n: number) => {
    this.y += n
    return this.y
  }
}

@model("P")
export class P extends Model({
  p2: prop(() => newModel(P2, {})),
  x: prop(0),
  arr: prop<number[]>(() => []),
  obj: prop<{ [k: string]: number }>(() => ({})),
}) {
  @modelAction
  addX(n: number) {
    this.x += n
    return this.x
  }

  @modelAction
  addXY(n1: number, n2: number) {
    this.addX(n1)
    this.p2.addY(n2)
    return n1 + n2
  }

  @modelAction
  addNumberToArrAndObj(n: number) {
    this.arr.push(n)
    this.obj["" + n] = n
  }
}

test("action tracking", () => {
  const events: any = []

  const p = newModel(P, {})

  autoDispose(
    addActionMiddleware({
      subtreeRoot: p,
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
            "$": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$": Object {
                  "y": 0,
                },
                "$modelType": "P2",
              },
              "x": 1,
            },
            "$modelType": "P",
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
            "$": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$": Object {
                  "y": 0,
                },
                "$modelType": "P2",
              },
              "x": 1,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": 1,
      },
    ]
  `)
  events.length = 0

  const resultY = p.p2.addY(2)
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
            "$": Object {
              "y": 2,
            },
            "$modelType": "P2",
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
            "$": Object {
              "y": 2,
            },
            "$modelType": "P2",
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
            "$": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$": Object {
                  "y": 4,
                },
                "$modelType": "P2",
              },
              "x": 2,
            },
            "$modelType": "P",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P {
            "$": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$": Object {
                  "y": 4,
                },
                "$modelType": "P2",
              },
              "x": 2,
            },
            "$modelType": "P",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P {
            "$": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$": Object {
                  "y": 4,
                },
                "$modelType": "P2",
              },
              "x": 2,
            },
            "$modelType": "P",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P2 {
            "$": Object {
              "y": 4,
            },
            "$modelType": "P2",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
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
              "$": Object {
                "arr": Array [],
                "obj": Object {},
                "p2": P2 {
                  "$": Object {
                    "y": 4,
                  },
                  "$modelType": "P2",
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P2 {
            "$": Object {
              "y": 4,
            },
            "$modelType": "P2",
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
            "$": Object {
              "arr": Array [],
              "obj": Object {},
              "p2": P2 {
                "$": Object {
                  "y": 4,
                },
                "$modelType": "P2",
              },
              "x": 2,
            },
            "$modelType": "P",
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
      subtreeRoot: p,
      middleware(_ctx, _next) {
        throw err
      },
    })
  )

  const x = p.x
  expect(() => p.addX(1)).toThrow(err)
  expect(p.x).toBe(x)
})

test("action cancel with new return value", () => {
  const val = 999

  const p = newModel(P, {})
  autoDispose(
    addActionMiddleware({
      subtreeRoot: p,
      middleware(_ctx) {
        return val
      },
    })
  )

  const x = p.x
  expect(p.addX(1)).toBe(val)
  expect(p.x).toBe(x)
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
    expect(pa.x).toStrictEqual(pb.x)
    expect(pa.p2.y).toStrictEqual(pb.p2.y)
  }

  {
    const ra = pa.addXY(1, 2)
    const rb = applyAction(pb, {
      targetPath: [],
      actionName: "addXY",
      args: [1, 2],
    })
    expect(ra).toBe(rb)
    expect(pa.x).toStrictEqual(pb.x)
    expect(pa.p2.y).toStrictEqual(pb.p2.y)
  }

  {
    const ra = pa.p2.addY(15)
    const rb = applyAction(pb, {
      targetPath: ["$", "p2"],
      actionName: "addY",
      args: [15],
    })
    expect(ra).toBe(rb)
    expect(pa.x).toStrictEqual(pb.x)
    expect(pa.p2.y).toStrictEqual(pb.p2.y)
  }

  {
    applySnapshot(pa.p2, {
      ...getSnapshot(pa.p2),
      y: 100,
    })
    applyAction(pb, {
      targetPath: ["$", "p2"],
      actionName: "$$applySnapshot",
      args: [{ ...getSnapshot(pb.p2), y: 100 }],
    })
    expect(pa.p2.y).toStrictEqual(pb.p2.y)
  }
})

test("action protection", () => {
  const p = newModel(P, {})

  const err = "data changes must be performed inside model actions"

  expect(() => {
    p.x = 100
  }).toThrow(err)

  expect(() => {
    p.p2.y = 100
  }).toThrow(err)

  expect(
    action(() => {
      p.arr.push(100)
    })
  ).toThrow(err)

  expect(
    action(() => {
      p.obj["a"] = 100
    })
  ).toThrow(err)

  p.addNumberToArrAndObj(200)

  expect(
    action(() => {
      p.arr.splice(0, 1)
    })
  ).toThrow(err)

  expect(
    action(() => {
      delete p.obj["200"]
    })
  ).toThrow(err)
})
