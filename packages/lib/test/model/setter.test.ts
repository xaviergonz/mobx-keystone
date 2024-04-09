import { computed } from "mobx"
import { addActionMiddleware, Model, modelAction, prop, tProp } from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("P")
export class P extends Model({
  y: prop(0).withSetter(),
  z: tProp(0).withSetter(),
  sy: prop(0).withSetter("assign"),
  sz: tProp(0).withSetter("assign"),
}) {
  @computed
  get cy() {
    return this.y * 10
  }

  @computed
  get cz() {
    return this.z * 10
  }

  @computed
  get csy() {
    return this.sy * 10
  }

  @computed
  get csz() {
    return this.sz * 10
  }
}

test("setter", () => {
  const events: any[] = []

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
    [
      {
        "ctx": {
          "actionName": "setY",
          "args": [
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 0,
              "sz": 0,
              "y": 5,
              "z": 0,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "setY",
          "args": [
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 0,
              "sz": 0,
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
    [
      {
        "ctx": {
          "actionName": "setZ",
          "args": [
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 0,
              "sz": 0,
              "y": 5,
              "z": 5,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "setZ",
          "args": [
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 0,
              "sz": 0,
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

  p.sy = 5
  expect(p.sy).toBe(5)
  expect(p.$.sy).toBe(5)
  expect(p.csy).toBe(50)

  expect(events).toMatchInlineSnapshot(`
    [
      {
        "ctx": {
          "actionName": "$$applySet",
          "args": [
            "sy",
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 5,
              "sz": 0,
              "y": 5,
              "z": 5,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "$$applySet",
          "args": [
            "sy",
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 5,
              "sz": 0,
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

  p.sz = 5
  expect(p.sz).toBe(5)
  expect(p.$.sz).toBe(5)
  expect(p.csz).toBe(50)

  expect(events).toMatchInlineSnapshot(`
    [
      {
        "ctx": {
          "actionName": "$$applySet",
          "args": [
            "sz",
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 5,
              "sz": 5,
              "y": 5,
              "z": 5,
            },
            "$modelType": "P",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "$$applySet",
          "args": [
            "sz",
            5,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": P {
            "$": {
              "sy": 5,
              "sz": 5,
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

test("setting null or undefined to a value with a default should set the default", () => {
  @testModel("M1")
  class M1 extends Model({
    x: prop(1).withSetter(),
  }) {
    @modelAction
    setXX(x: number) {
      this.x = x
    }
  }

  const m1 = new M1({
    x: 10,
  })

  const reset = () => {
    m1.setX(10)
    expect(m1.x).toBe(10)
  }

  reset()
  m1.setX(undefined as any)
  expect(m1.x).toBe(1)

  reset()
  m1.setX(null as any)
  expect(m1.x).toBe(1)

  reset()
  m1.setXX(undefined as any)
  expect(m1.x).toBe(1)

  reset()
  m1.setXX(null as any)
  expect(m1.x).toBe(1)
})
