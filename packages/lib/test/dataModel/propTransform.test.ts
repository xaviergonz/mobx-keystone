import { assert, _ } from "spec.ts"
import {
  DataModel,
  getSnapshot,
  model,
  modelAction,
  prop,
  timestampToDateTransform,
  tProp,
  types,
} from "../../src"

test("prop with transform and required value", () => {
  @model("pwt/Trequired")
  class T extends DataModel({
    date: prop<number>().withSetter().withTransform(timestampToDateTransform()),
  }) {
    @modelAction
    setTimestamp(ts: number) {
      this.$.date = ts
    }
  }

  const d = new Date(1000)
  const d2 = new Date(2000)

  const t = new T({
    date: d,
  })

  assert(t.date, _ as Date)
  expect(t.date instanceof Date).toBe(true)
  expect(+t.date).toBe(1000)
  expect(t.date).toBe(t.date) // should be cached

  assert(t.$.date, _ as number)
  expect(t.$.date).toBe(1000)

  t.setDate(d2)

  expect(t.date instanceof Date).toBe(true)
  expect(+t.date).toBe(2000)
  expect(t.$.date).toBe(2000)
  expect(t.date).toBe(t.date) // should be cached

  const tsn = getSnapshot(t.$)
  assert(tsn.date, _ as number)

  t.setTimestamp(500)
  expect(t.date instanceof Date).toBe(true)
  expect(+t.date).toBe(500)
  expect(t.$.date).toBe(500)
  expect(t.date).toBe(t.date) // should be cached
})

test("prop with transform and default value", () => {
  @model("pwt/Tdefault")
  class T extends DataModel({
    date: prop(1000).withTransform(timestampToDateTransform()).withSetter(),
  }) {}

  const d2 = new Date(2000)

  const t = new T({})

  assert(t.date, _ as Date)
  expect(t.date instanceof Date).toBe(true)
  expect(+t.date).toBe(1000)

  assert(t.$.date, _ as number)
  expect(t.$.date).toBe(1000)

  t.setDate(d2)

  expect(t.date instanceof Date).toBe(true)
  expect(+t.date).toBe(2000)
  expect(t.$.date).toBe(2000)

  const tsn = getSnapshot(t.$)
  assert(tsn.date, _ as number)
})

test("prop with transform and can be null | undefined", () => {
  @model("pwt/Tundefined")
  class T extends DataModel({
    date: prop<number | undefined | null>().withSetter().withTransform(timestampToDateTransform()),
  }) {}

  const d = new Date(1000)

  const t = new T({
    date: d,
  })

  assert(t.date, _ as Date | undefined | null)
  expect(t.date instanceof Date).toBe(true)
  expect(+t.date!).toBe(1000)

  assert(t.$.date, _ as number | undefined | null)
  expect(t.$.date).toBe(1000)

  t.setDate(null)

  expect(t.date).toBe(null)
  expect(t.$.date).toBe(null)

  t.setDate(undefined)

  expect(t.date).toBe(undefined)
  expect(t.$.date).toBe(undefined)

  const tsn = getSnapshot(t.$)
  assert(tsn.date, _ as number | undefined | null)
})

test("prop with transform and can be null", () => {
  @model("pwt/tTundefined")
  class T extends DataModel({
    date: tProp(types.maybeNull(types.number))
      .withSetter()
      .withTransform(timestampToDateTransform()),
  }) {}

  const d = new Date(1000)

  const t = new T({
    date: d,
  })

  assert(t.date, _ as Date | null)
  expect(t.date instanceof Date).toBe(true)
  expect(+t.date!).toBe(1000)

  assert(t.$.date, _ as number | null)
  expect(t.$.date).toBe(1000)

  t.setDate(null)

  expect(t.date).toBe(null)
  expect(t.$.date).toBe(null)

  const tsn = getSnapshot(t.$)
  assert(tsn.date, _ as number | null)
})
