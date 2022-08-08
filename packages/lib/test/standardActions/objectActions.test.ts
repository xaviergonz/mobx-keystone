import { Model, modelAction, objectActions, prop } from "../../src"
import { testModel } from "../utils"

test("typed object", () => {
  const obj = objectActions.create({ a: 1 })
  expect(obj.a).toBe(1)

  objectActions.set(obj, "a", 2)
  expect(obj.a).toBe(2)

  objectActions.delete(obj, "a")
  expect(obj.a).toBe(undefined)

  objectActions.assign(obj, { a: 3 })
  expect(obj.a).toBe(3)
})

test("untyped object", () => {
  const obj = objectActions.create<any>({ a: 1 })
  expect(obj.a).toBe(1)

  objectActions.set(obj, "b", 2)
  expect(obj.b).toBe(2)

  objectActions.delete(obj, "b")
  expect(obj.b).toBe(undefined)

  objectActions.assign(obj, { b: 3 })
  expect(obj.b).toBe(3)
})

test("over a model", () => {
  @testModel("M")
  class M extends Model({ x: prop(10) }) {
    // without action
    setXNoAction(n: number) {
      this.x = n
      return n
    }

    @modelAction
    setXAction(n: number) {
      this.x = n
      return n
    }
  }

  const m = new M({})

  expect(objectActions.call(m, "setXNoAction", 20)).toBe(20)
  expect(m.x).toBe(20)

  expect(objectActions.call(m, "setXAction", 30)).toBe(30)
  expect(m.x).toBe(30)

  objectActions.set(m, "x", 40)
  expect(m.x).toBe(40)
})
