import { observable } from "mobx"
import {
  ActionCall,
  ActionContext,
  applySnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  newModel,
  onActionMiddleware,
  serializeActionCallArgument,
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
    this.$.y += n
    return this.$.y
  }
}

@model("P")
export class P extends Model<{ p2: P2; x: number }> {
  defaultData = {
    p2: newModel(P2, {}),
    x: 0,
  }

  @modelAction
  addX(n: number, _unserializable?: any) {
    this.$.x += n
    return this.$.x
  }

  @modelAction
  other(..._any: any[]) {}

  @modelAction
  addXY(n1: number, n2: number) {
    this.addX(n1)
    this.$.p2.addY(n2)
    return n1 + n2
  }
}

test("onActionMiddleware", () => {
  const p1 = newModel(P, {})
  const p2 = newModel(P, {})

  const events: [ActionCall, ActionContext][] = []
  function reset() {
    events.length = 0
  }

  const disposer = onActionMiddleware(p1, {
    onStart(actionCall, ctx) {
      events.push([actionCall, ctx])
    },
  })
  autoDispose(disposer)

  // action on the root
  p1.addX(1)
  p2.addX(1)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "addX",
          "args": Array [
            1,
          ],
          "targetId": "mockedUuid-2",
          "targetPath": Array [],
        },
        Object {
          "actionName": "addX",
          "args": Array [
            1,
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
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
              },
              "x": 1,
            },
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // action on the child
  reset()
  p1.$.p2.addY(2)
  p2.$.p2.addY(2)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "addY",
          "args": Array [
            2,
          ],
          "targetId": "mockedUuid-1",
          "targetPath": Array [
            "$",
            "p2",
          ],
        },
        Object {
          "actionName": "addY",
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
          "target": P2 {
            "$": Object {
              "y": 2,
            },
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // action on the root with sub-action on the child
  reset()
  p1.addXY(3, 4)
  p2.addXY(3, 4)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "addXY",
          "args": Array [
            3,
            4,
          ],
          "targetId": "mockedUuid-2",
          "targetPath": Array [],
        },
        Object {
          "actionName": "addXY",
          "args": Array [
            3,
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
                  "y": 6,
                },
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
              },
              "x": 4,
            },
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // unserializable args
  reset()
  class RandomClass {}
  const rc = new RandomClass()

  p1.other(rc)
  p2.other(rc)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "other",
          "args": Array [
            RandomClass {},
          ],
          "targetId": "mockedUuid-2",
          "targetPath": Array [],
        },
        Object {
          "actionName": "other",
          "args": Array [
            RandomClass {},
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
                  "y": 6,
                },
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
              },
              "x": 4,
            },
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // array, obs array
  reset()
  p1.other([1, 2, 3], observable([4, 5, 6]))
  p2.other([1, 2, 3], observable([4, 5, 6]))
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "other",
          "args": Array [
            Array [
              1,
              2,
              3,
            ],
            Array [
              4,
              5,
              6,
            ],
          ],
          "targetId": "mockedUuid-2",
          "targetPath": Array [],
        },
        Object {
          "actionName": "other",
          "args": Array [
            Array [
              1,
              2,
              3,
            ],
            Array [
              4,
              5,
              6,
            ],
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
                  "y": 6,
                },
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
              },
              "x": 4,
            },
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // obj, obs obj
  reset()
  p1.other({ a: 5 }, observable({ a: 5 }))
  p2.other({ a: 5 }, observable({ a: 5 }))
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "other",
          "args": Array [
            Object {
              "a": 5,
            },
            Object {
              "a": 5,
            },
          ],
          "targetId": "mockedUuid-2",
          "targetPath": Array [],
        },
        Object {
          "actionName": "other",
          "args": Array [
            Object {
              "a": 5,
            },
            Object {
              "a": 5,
            },
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
                  "y": 6,
                },
                "$$metadata": Object {
                  "id": "mockedUuid-1",
                  "type": "P2",
                },
              },
              "x": 4,
            },
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P",
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // applySnapshot
  reset()
  applySnapshot(p1.$.p2, {
    ...getSnapshot(p1.$.p2),
    y: 100,
  })
  applySnapshot(p2.$.p2, {
    ...getSnapshot(p2.$.p2),
    y: 100,
  })
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "$$applySnapshot",
          "args": Array [
            Object {
              "$$metadata": Object {
                "id": "mockedUuid-1",
                "type": "P2",
              },
              "y": 100,
            },
          ],
          "targetId": "mockedUuid-1",
          "targetPath": Array [
            "$",
            "p2",
          ],
        },
        Object {
          "actionName": "$$applySnapshot",
          "args": Array [
            Object {
              "$$metadata": Object {
                "id": "mockedUuid-1",
                "type": "P2",
              },
              "y": 100,
            },
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
          "target": P2 {
            "$": Object {
              "y": 100,
            },
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // disposing
  reset()
  disposer()
  p1.addXY(5, 6)
  p2.addXY(5, 6)
  expect(events).toMatchInlineSnapshot(`Array []`)
})

test("serializeActionCallArgument", () => {
  // unserializable args
  class RandomClass {}
  const rc = new RandomClass()

  expect(() => serializeActionCallArgument(rc)).toThrow(
    "serializeActionCallArgument could not serialize the given value"
  )

  // TODO: unit test the good cases
})

// TODO: unit test deserializeActionCall + argument
