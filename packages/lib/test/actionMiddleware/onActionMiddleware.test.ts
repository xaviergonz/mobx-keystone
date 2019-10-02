import { observable } from "mobx"
import {
  ActionCall,
  ActionContext,
  applySnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  onActionMiddleware,
  prop,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P2")
export class P2 extends Model({
  y: prop(() => 0),
}) {
  @modelAction
  addY = (n: number) => {
    this.y += n
    return this.y
  }
}

@model("P")
export class P extends Model({
  p2: prop(() => new P2({})),
  x: prop(() => 0),
}) {
  @modelAction
  addX(n: number, _unserializable?: any) {
    this.x += n
    return this.x
  }

  @modelAction
  other(..._any: any[]) {}

  @modelAction
  addXY(n1: number, n2: number) {
    this.addX(n1)
    this.p2.addY(n2)
    return n1 + n2
  }
}

test("onActionMiddleware", () => {
  const p1 = new P({})
  const p2 = new P({})

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
          "targetPath": Array [],
          "targetPathIds": Array [],
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
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 1,
            },
            "$modelId": "id-1",
            "$modelType": "P",
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // action on the child
  reset()
  p1.p2.addY(2)
  p2.p2.addY(2)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "addY",
          "args": Array [
            2,
          ],
          "targetPath": Array [
            "p2",
          ],
          "targetPathIds": Array [
            "id-2",
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
            "$modelId": "id-2",
            "$modelType": "P2",
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
          "targetPath": Array [],
          "targetPathIds": Array [],
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
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 4,
            },
            "$modelId": "id-1",
            "$modelType": "P",
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
          "targetPath": Array [],
          "targetPathIds": Array [],
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
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 4,
            },
            "$modelId": "id-1",
            "$modelType": "P",
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
          "targetPath": Array [],
          "targetPathIds": Array [],
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
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 4,
            },
            "$modelId": "id-1",
            "$modelType": "P",
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
          "targetPath": Array [],
          "targetPathIds": Array [],
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
                "$modelId": "id-2",
                "$modelType": "P2",
              },
              "x": 4,
            },
            "$modelId": "id-1",
            "$modelType": "P",
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // applySnapshot
  reset()
  applySnapshot(p1.p2, {
    ...getSnapshot(p1.p2),
    y: 100,
  })
  applySnapshot(p2.p2, {
    ...getSnapshot(p2.p2),
    y: 100,
  })
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "actionName": "$$applySnapshot",
          "args": Array [
            Object {
              "$modelId": "id-2",
              "$modelType": "P2",
              "y": 100,
            },
          ],
          "targetPath": Array [
            "p2",
          ],
          "targetPathIds": Array [
            "id-2",
          ],
        },
        Object {
          "actionName": "$$applySnapshot",
          "args": Array [
            Object {
              "$modelId": "id-2",
              "$modelType": "P2",
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
            "$modelId": "id-2",
            "$modelType": "P2",
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
