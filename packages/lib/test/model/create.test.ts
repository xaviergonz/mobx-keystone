import {
  getParentPath,
  getSnapshot,
  idProp,
  Model,
  modelIdKey,
  prop,
  runUnprotected,
  tProp,
  types,
} from "../../src"
import { testModel } from "../utils"

test("empty construction snapshots include primitive defaults, undefined slots, and generated IDs", () => {
  @testModel("EmptyPrimitiveDefaults")
  class M extends Model({
    id: idProp,
    value: prop(1),
    optional: prop<number | undefined>(),
  }) {}
  const input = {}
  const m = new M(input)
  const held = getSnapshot(m)
  expect(held).toEqual({
    $modelType: m.$modelType,
    id: m.id,
    value: 1,
    optional: undefined,
  })
  expect(Object.hasOwn(held, "optional")).toBe(true)
  expect(Object.getPrototypeOf(held)).toBe(Object.prototype)
  Object.assign(input, { value: 9 })
  runUnprotected(() => {
    m.value = 2
  })
  expect(held.value).toBe(1)
  expect(getSnapshot(m).value).toBe(2)
})

test("structured defaults keep normal tree initialization after primitive defaults", () => {
  @testModel("EmptyStructuredDefaults")
  class M extends Model({
    before: prop(1),
    list: prop(() => [{ value: 2 }]),
    object: prop(() => ({ value: 3 })),
    after: prop(4),
  }) {}
  const m = new M({})
  const held = getSnapshot(m)
  expect(held).toMatchObject({ before: 1, list: [{ value: 2 }], object: { value: 3 }, after: 4 })
  expect(getParentPath(m.list)).toEqual({ parent: m, path: "list" })
  expect(getParentPath(m.list[0])).toEqual({ parent: m.list, path: 0 })
  expect(getParentPath(m.object)).toEqual({ parent: m, path: "object" })
  runUnprotected(() => {
    m.list[0].value = 20
    m.object.value = 30
  })
  expect(held.list[0].value).toBe(2)
  expect(held.object.value).toBe(3)
  expect(getSnapshot(m)).toMatchObject({ list: [{ value: 20 }], object: { value: 30 } })
})

describe("create with extra properties", () => {
  const data = { value: 0, a: 2 }

  test("with unchecked props", () => {
    @testModel("M-unchecked")
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
    @testModel("M-checked")
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
    @testModel("M-customId")
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
