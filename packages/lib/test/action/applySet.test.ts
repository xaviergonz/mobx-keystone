import {
  addActionMiddleware,
  applyAction,
  applySet,
  BuiltInAction,
  model,
  Model,
  prop,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P")
export class P extends Model({
  y: prop(0),
  ch: prop<P | undefined>(undefined),
  obj: prop<{ [k: string]: number } | undefined>(undefined),
}) {}

test("applySet", () => {
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

  applySet(p, "y", 5)
  expect(p.y).toBe(5)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "$$applySet",
          "args": Array [
            "y",
            5,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "ch": undefined,
              "obj": undefined,
              "y": 5,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "$$applySet",
          "args": Array [
            "y",
            5,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "ch": undefined,
              "obj": undefined,
              "y": 5,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
    ]
  `)

  // apply action should work
  applyAction(p, {
    actionName: BuiltInAction.ApplySet,
    args: ["y", 3],
    targetPath: [],
    targetPathIds: [],
  })

  expect(p.y).toBe(3)

  // complex props
  events.length = 0
  const p2 = new P({ y: 1 })
  applySet(p, "ch", p2)
  expect(p.ch).toBe(p2)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "$$applySet",
          "args": Array [
            "ch",
            P {
              "$": Object {
                "ch": undefined,
                "obj": undefined,
                "y": 1,
              },
              "$modelType": "P",
            },
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "ch": P {
                "$": Object {
                  "ch": undefined,
                  "obj": undefined,
                  "y": 1,
                },
                "$modelType": "P",
              },
              "obj": undefined,
              "y": 3,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "$$applySet",
          "args": Array [
            "ch",
            P {
              "$": Object {
                "ch": undefined,
                "obj": undefined,
                "y": 1,
              },
              "$modelType": "P",
            },
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "ch": P {
                "$": Object {
                  "ch": undefined,
                  "obj": undefined,
                  "y": 1,
                },
                "$modelType": "P",
              },
              "obj": undefined,
              "y": 3,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
    ]
  `)

  const p3 = new P({ y: 2 })
  applyAction(p, {
    actionName: BuiltInAction.ApplySet,
    args: ["ch", p3],
    targetPath: [],
    targetPathIds: [],
  })

  expect(p.ch).toBe(p3)

  // check it also works over plain objs
  applySet(p, "obj", { a: 1 })
  expect(p.obj!.a).toBe(1)

  applySet(p.obj!, "a", 2)
  expect(p.obj!.a).toBe(2)

  applySet(p.obj!, "b", 3)
  expect(p.obj!.b).toBe(3)
})
