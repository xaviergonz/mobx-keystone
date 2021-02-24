import { computed } from "mobx"
import { addActionMiddleware, model, Model, prop, tProp } from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P")
export class P extends Model({
  y: prop(0, { setterAction: true }),
  z: tProp(0, { setterAction: true }),
}) {
  @computed
  get cy() {
    return this.y * 10
  }

  @computed
  get cz() {
    return this.z * 10
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

  p.setY(5)
  expect(p.y).toBe(5)
  expect(p.$.y).toBe(5)
  expect(p.cy).toBe(50)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "setY",
          "args": Array [
            5,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "$modelId": "id-1",
              "y": 5,
              "z": 0,
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
            5,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "$modelId": "id-1",
              "y": 5,
              "z": 0,
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

  p.setZ(5)
  expect(p.z).toBe(5)
  expect(p.$.z).toBe(5)
  expect(p.cz).toBe(50)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "setZ",
          "args": Array [
            5,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "$modelId": "id-1",
              "y": 5,
              "z": 5,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "setZ",
          "args": Array [
            5,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": Object {
              "$modelId": "id-1",
              "y": 5,
              "z": 5,
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
