import { idProp, model, Model, modelIdKey, prop, tProp, types } from "../../src"

describe("create with extra properties", () => {
  const data = { value: 0, a: 2 }

  test("with unchecked props", () => {
    @model("M-unchecked")
    class M extends Model({
      [modelIdKey]: idProp,
      value: prop<number>(),
    }) {}

    const m = new M(data)
    expect(m instanceof M).toBeTruthy()
    expect(m.value).toBe(0)
    expect((m as any).a).toBeUndefined()
    expect((m.$ as any).a).toBe(2)
    expect((m.$ as any)[modelIdKey]).toBe(m[modelIdKey])
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
    expect((m.$ as any)[modelIdKey]).toBe(m[modelIdKey])
  })

  test("with a custom model id", () => {
    @model("M-customId")
    class M extends Model({
      id: idProp,
    }) {}

    const m = new M({ id: "123" })
    expect(m instanceof M).toBeTruthy()
    expect(m.id).toBe("123")
    expect(m.$.id).toBe("123")
    expect(m[modelIdKey]).toBe("123")
    expect((m.$ as any)[modelIdKey]).toBe(undefined) // should not be actually stored
  })
})
