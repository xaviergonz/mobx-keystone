import { computed } from "mobx"
import { addActionMiddleware, model, Model, modelAction, prop } from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P")
export class P extends Model({
  y: prop(0, { setterAction: true }),
}) {
  @computed
  get cv() {
    return this.y * 10
  }

  @modelAction
  setY(n: number) {
    this.y = n
  }
}

test("setterAction", () => {
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

  p.y = 5
  expect(p.y).toBe(5)
  expect(p.$.y).toBe(5)
  expect(p.cv).toBe(50)

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
  events.length = 0

  // check that it is not wrapped in action when used inside an action already
  p.setY(10)
  expect(p.y).toBe(10)
  expect(p.$.y).toBe(10)
  expect(p.cv).toBe(100)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "setY",
          "args": Array [
            10,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "y": 10,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "setY",
          "args": Array [
            10,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "y": 10,
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
  events.length = 0
})
