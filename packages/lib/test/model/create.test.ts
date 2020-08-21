import { model, Model, prop, tProp, types } from "../../src"
import "../commonSetup"

describe("create with extra properties", () => {
  const data = { value: 0, a: 2 }

  test("with unchecked props", () => {
    @model("M-unchecked")
    class M extends Model({
      value: prop<number>(),
    }) {}

    const m = new M(data)
    expect(m instanceof M).toBeTruthy()
    expect(m.value).toBe(0)
    expect((m as any).a).toBeUndefined()
    expect((m.$ as any).a).toBe(2)
  })

  test("with checked props", () => {
    @model("M-checked")
    class M extends Model({
      value: tProp(types.number),
    }) {}

    const m = new M(data)
    expect(m instanceof M).toBeTruthy()
    expect(m.value).toBe(0)
    expect((m as any).a).toBeUndefined()
    expect((m.$ as any).a).toBe(2)
  })
})
