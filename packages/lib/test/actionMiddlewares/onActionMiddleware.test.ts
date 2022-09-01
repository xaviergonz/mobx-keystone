import { observable } from "mobx"
import {
  ActionCall,
  ActionContext,
  applySnapshot,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelIdKey,
  onActionMiddleware,
  prop,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("P2")
export class P2 extends Model({
  [modelIdKey]: idProp,
  y: prop(() => 0),
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
    [
      [
        {
          "actionName": "addX",
          "args": [
            1,
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        {
          "actionName": "addX",
          "args": [
            1,
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
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
      ],
    ]
  `)

  // action on the child
  reset()
  p1.p2.addY(2)
  p2.p2.addY(2)
  expect(events).toMatchInlineSnapshot(`
    [
      [
        {
          "actionName": "addY",
          "args": [
            2,
          ],
          "targetPath": [
            "p2",
          ],
          "targetPathIds": [
            "id-2",
          ],
        },
        {
          "actionName": "addY",
          "args": [
            2,
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
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
      ],
    ]
  `)

  // action on the root with sub-action on the child
  reset()
  p1.addXY(3, 4)
  p2.addXY(3, 4)
  expect(events).toMatchInlineSnapshot(`
    [
      [
        {
          "actionName": "addXY",
          "args": [
            3,
            4,
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        {
          "actionName": "addXY",
          "args": [
            3,
            4,
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 6,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 4,
            },
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
    [
      [
        {
          "actionName": "other",
          "args": [
            RandomClass {},
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        {
          "actionName": "other",
          "args": [
            RandomClass {},
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 6,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 4,
            },
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
    [
      [
        {
          "actionName": "other",
          "args": [
            [
              1,
              2,
              3,
            ],
            [
              4,
              5,
              6,
            ],
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        {
          "actionName": "other",
          "args": [
            [
              1,
              2,
              3,
            ],
            [
              4,
              5,
              6,
            ],
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 6,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 4,
            },
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
    [
      [
        {
          "actionName": "other",
          "args": [
            {
              "a": 5,
            },
            {
              "a": 5,
            },
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        {
          "actionName": "other",
          "args": [
            {
              "a": 5,
            },
            {
              "a": 5,
            },
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "$modelId": "id-1",
              "p2": P2 {
                "$": {
                  "$modelId": "id-2",
                  "y": 6,
                },
                "$modelType": "P2",
                "addY": [Function],
              },
              "x": 4,
            },
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
    [
      [
        {
          "actionName": "$$applySnapshot",
          "args": [
            {
              "$modelId": "id-2",
              "$modelType": "P2",
              "y": 100,
            },
          ],
          "targetPath": [
            "p2",
          ],
          "targetPathIds": [
            "id-2",
          ],
        },
        {
          "actionName": "$$applySnapshot",
          "args": [
            {
              "$modelId": "id-2",
              "$modelType": "P2",
              "y": 100,
            },
          ],
          "data": {
            Symbol(simpleDataContext): [Circular],
            Symbol(actionTrackingMiddlewareData): {
              "startAccepted": true,
              "state": "finished",
            },
          },
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P2 {
            "$": {
              "$modelId": "id-2",
              "y": 100,
            },
            "$modelType": "P2",
            "addY": [Function],
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
  expect(events).toMatchInlineSnapshot(`[]`)
})
