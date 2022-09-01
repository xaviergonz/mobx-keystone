import { action, remove, set } from "mobx"
import {
  addActionMiddleware,
  applyAction,
  applySnapshot,
  ExtendedModel,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelIdKey,
  prop,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("P2")
export class P2 extends Model({
  [modelIdKey]: idProp,
  y: prop(0),
}) {
  @modelAction
  addY = (n: number) => {
    this.y += n
    return this.y
  }
}

@testModel("P")
export class P extends Model({
  [modelIdKey]: idProp,
  p2: prop(() => new P2({})),
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
    // this is valid in mobx5 but not mobx4
    // this.obj["" + n] = n
    set(this.obj, "" + n, n)
  }
}

test("action tracking", () => {
  const events: any = []

  const p = new P({})

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
    [
      {
        "ctx": {
          "actionName": "addX",
          "args": [
            1,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "arr": [],
              "obj": {},
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 0,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 1,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "addX",
          "args": [
            1,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "arr": [],
              "obj": {},
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 0,
                },
                "$modelType": "P2",
                "addY": [Function],
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
    [
      {
        "ctx": {
          "actionName": "addY",
          "args": [
            2,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P2 {
            "$": {
              "$modelId": "id-2",
              "y": 2,
            },
            "$modelType": "P2",
            "addY": [Function],
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "addY",
          "args": [
            2,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P2 {
            "$": {
              "$modelId": "id-2",
              "y": 2,
            },
            "$modelType": "P2",
            "addY": [Function],
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
    [
      {
        "ctx": {
          "actionName": "addXY",
          "args": [
            1,
            2,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "arr": [],
              "obj": {},
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 4,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 2,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "addX",
          "args": [
            1,
          ],
          "data": {},
          "parentContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P {
            "$": {
              "$modelId": "id-1",
              "arr": [],
              "obj": {},
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 4,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 2,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "addX",
          "args": [
            1,
          ],
          "data": {},
          "parentContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P {
            "$": {
              "$modelId": "id-1",
              "arr": [],
              "obj": {},
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 4,
                },
                "$modelType": "P2",
                "addY": [Function],
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
      {
        "ctx": {
          "actionName": "addY",
          "args": [
            2,
          ],
          "data": {},
          "parentContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P2 {
            "$": {
              "$modelId": "id-2",
              "y": 4,
            },
            "$modelType": "P2",
            "addY": [Function],
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "addY",
          "args": [
            2,
          ],
          "data": {},
          "parentContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "addXY",
            "args": [
              1,
              2,
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": P {
              "$": {
                "$modelId": "id-1",
                "arr": [],
                "obj": {},
                "p2": P2 {
                  "$": {
                    "$modelId": "id-2",
                    "y": 4,
                  },
                  "$modelType": "P2",
                  "addY": [Function],
                },
                "x": 2,
              },
              "$modelType": "P",
            },
            "type": "sync",
          },
          "target": P2 {
            "$": {
              "$modelId": "id-2",
              "y": 4,
            },
            "$modelType": "P2",
            "addY": [Function],
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": 4,
      },
      {
        "ctx": {
          "actionName": "addXY",
          "args": [
            1,
            2,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "arr": [],
              "obj": {},
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 4,
                },
                "$modelType": "P2",
                "addY": [Function],
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

  const p = new P({})
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

  const p = new P({})
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
  const pa = new P({})
  const pb = new P({})

  {
    const ra = pa.addX(10)
    const rb = applyAction(pb, {
      targetPath: [],
      targetPathIds: [],
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
      targetPathIds: [],
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
      targetPath: ["p2"],
      targetPathIds: [pb.p2.$modelId!],
      actionName: "addY",
      args: [15],
    })
    expect(ra).toBe(rb)
    expect(pa.x).toStrictEqual(pb.x)
    expect(pa.p2.y).toStrictEqual(pb.p2.y)
  }

  applySnapshot(pa.p2, {
    ...getSnapshot(pa.p2),
    y: 100,
  })
  applyAction(pb, {
    targetPath: ["p2"],
    targetPathIds: [pb.p2.$modelId!],
    actionName: "$$applySnapshot",
    args: [{ ...getSnapshot(pb.p2), y: 100 }],
  })
  expect(pa.p2.y).toStrictEqual(pb.p2.y)

  // if the id of a sub-object does not match it should fail
  expect(() => {
    applyAction(pb, {
      targetPath: ["p2"],
      targetPathIds: ["NOT A GOOD ID"],
      actionName: "addY",
      args: [15],
    })
  }).toThrow('object at path ["p2"] with ids ["NOT A GOOD ID"] could not be resolved')
})

test("action protection", () => {
  const p = new P({})

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
      // this is valid in mobx5 but not mobx4
      // p.obj["a"] = 100
      set(p.obj, "a", 100)
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
      // this is valid in mobx5 but not mobx4
      // delete p.obj["200"]
      remove(p.obj, "200")
    })
  ).toThrow(err)
})

test("arrow model actions work when destructured", () => {
  @testModel("M")
  class M extends Model({
    x: prop(0),
  }) {
    @modelAction
    addX = (n: number) => {
      this.x += n
      return this.x
    }
  }

  {
    const m = new M({})
    expect(m.addX(1)).toBe(1)
    const { addX } = m
    expect(addX(1)).toBe(2)
  }

  @testModel("M2")
  class M2 extends ExtendedModel(M, {}) {}

  {
    const m2 = new M2({})
    expect(m2.addX(1)).toBe(1)
    const { addX } = m2
    expect(addX(1)).toBe(2)
  }
})
