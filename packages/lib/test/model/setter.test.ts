import { computed } from "mobx"
import {
  addActionMiddleware,
  cloneTreeValue,
  idProp,
  Model,
  modelAction,
  prop,
  tProp,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test("setter", () => {
  @testModel("P")
  class P extends Model({
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
            "$modelType": "setter/P",
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
            "$modelType": "setter/P",
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
            "$modelType": "setter/P",
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
            "$modelType": "setter/P",
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
            "$modelType": "setter/P",
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
            "$modelType": "setter/P",
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
            "$modelType": "setter/P",
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
            "$modelType": "setter/P",
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

test("withSetter(cloneTreeValue) avoids parent collisions for reused objects", () => {
  @testModel("SetterNoClone")
  class SetterNoClone extends Model({
    a: prop<{ x: number } | undefined>().withSetter(),
    b: prop<{ x: number } | undefined>().withSetter(),
  }) {}

  @testModel("SetterClonePlain")
  class SetterClonePlain extends Model({
    a: prop<{ x: number; nested: { y: number } } | undefined>().withSetter(cloneTreeValue),
    b: prop<{ x: number; nested: { y: number } } | undefined>().withSetter(cloneTreeValue),
  }) {}

  const withoutClone = new SetterNoClone({})
  withoutClone.setA({ x: 1 })

  expect(() => withoutClone.setB(withoutClone.a!)).toThrow(
    "an object cannot be assigned a new parent when it already has one"
  )

  const withClone = new SetterClonePlain({})
  withClone.setA({ x: 1, nested: { y: 2 } })
  withClone.setB(withClone.a!)

  expect(withClone.a).not.toBe(withClone.b)
  expect(withClone.a?.nested).not.toBe(withClone.b?.nested)
  expect(withClone.b).toStrictEqual({ x: 1, nested: { y: 2 } })
})

test("cloneTreeValue uses clone-style options", () => {
  @testModel("SetterCloneChildWithId")
  class SetterCloneChildWithId extends Model({
    id: idProp,
    value: prop(0),
  }) {}

  @testModel("SetterCloneModelWithId")
  class SetterCloneModelWithId extends Model({
    a: prop<SetterCloneChildWithId | undefined>().withSetter(cloneTreeValue),
    b: prop<SetterCloneChildWithId | undefined>().withSetter(cloneTreeValue),
  }) {}

  @testModel("SetterCloneModelWithIdNoNewIds")
  class SetterCloneModelWithIdNoNewIds extends Model({
    a: prop<SetterCloneChildWithId | undefined>().withSetter((v) =>
      cloneTreeValue(v, { generateNewIds: false })
    ),
    b: prop<SetterCloneChildWithId | undefined>().withSetter((v) =>
      cloneTreeValue(v, { generateNewIds: false })
    ),
  }) {}

  const child = new SetterCloneChildWithId({ id: "child-id", value: 7 })

  const withNewIds = new SetterCloneModelWithId({})
  withNewIds.setA(child)
  withNewIds.setB(child)

  expect(withNewIds.a).not.toBe(withNewIds.b)
  expect(withNewIds.a).not.toBe(child)
  expect(withNewIds.b).not.toBe(child)
  expect(withNewIds.a?.value).toBe(7)
  expect(withNewIds.b?.value).toBe(7)
  expect(withNewIds.a?.id).not.toBe(child.id)
  expect(withNewIds.b?.id).not.toBe(child.id)
  expect(withNewIds.a?.id).not.toBe(withNewIds.b?.id)

  const withoutNewIds = new SetterCloneModelWithIdNoNewIds({})
  withoutNewIds.setA(child)
  withoutNewIds.setB(child)

  expect(withoutNewIds.a).not.toBe(withoutNewIds.b)
  expect(withoutNewIds.a).not.toBe(child)
  expect(withoutNewIds.b).not.toBe(child)
  expect(withoutNewIds.a?.value).toBe(7)
  expect(withoutNewIds.b?.value).toBe(7)
  expect(withoutNewIds.a?.id).toBe(child.id)
  expect(withoutNewIds.b?.id).toBe(child.id)
})

test("withSetter(fn) transforms the assigned value", () => {
  @testModel("SetterValueTransform")
  class SetterValueTransform extends Model({
    x: prop(0).withSetter((v) => v * 2),
  }) {}

  const m = new SetterValueTransform({})
  m.setX(3)
  expect(m.x).toBe(6)
})
