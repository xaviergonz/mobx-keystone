import { fnObject, Model, model, modelAction, prop } from "../../src"
import "../commonSetup"

test("typed object", () => {
  const obj = fnObject.create({ a: 1 })
  expect(obj.a).toBe(1)

  fnObject.set(obj, "a", 2)
  expect(obj.a).toBe(2)

  fnObject.delete(obj, "a")
  expect(obj.a).toBe(undefined)

  fnObject.assign(obj, { a: 3 })
  expect(obj.a).toBe(3)
})

test("untyped object", () => {
  const obj = fnObject.create<any>({ a: 1 })
  expect(obj.a).toBe(1)

  fnObject.set(obj, "b", 2)
  expect(obj.b).toBe(2)

  fnObject.delete(obj, "b")
  expect(obj.b).toBe(undefined)

  fnObject.assign(obj, { b: 3 })
  expect(obj.b).toBe(3)
})

test("over a model", () => {
  @model(`${test.name}/M`)
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

  expect(fnObject.call(m, "setXNoAction", 20)).toBe(20)
  expect(m.x).toBe(20)

  expect(fnObject.call(m, "setXAction", 30)).toBe(30)
  expect(m.x).toBe(30)

  fnObject.set(m, "x", 40)
  expect(m.x).toBe(40)
})
