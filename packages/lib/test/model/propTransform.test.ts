import { assert, _ } from "spec.ts"
import {
  arrayToMapTransform,
  arrayToSetTransform,
  ExtendedModel,
  fromSnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  objectToMapTransform,
  prop,
  runUnprotected,
  timestampToDateTransform,
  tProp,
  types,
} from "../../src"
import "../commonSetup"

test("prop with transform and required value", () => {
  @model("pwt/Trequired")
  class T extends Model({
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

  const tsn = getSnapshot(t)
  assert(tsn.date, _ as number)
  const tfsn = fromSnapshot<T>(tsn)
  assert(tfsn.date, _ as Date)
  expect(tfsn.date instanceof Date).toBe(true)
  expect(+tfsn.date).toBe(2000)

  t.setTimestamp(500)
  expect(t.date instanceof Date).toBe(true)
  expect(+t.date).toBe(500)
  expect(t.$.date).toBe(500)
  expect(t.date).toBe(t.date) // should be cached
})

test("prop with transform and default value", () => {
  @model("pwt/Tdefault")
  class T extends Model({
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

  const tsn = getSnapshot(t)
  assert(tsn.date, _ as number)
  const tfsn = fromSnapshot<T>(tsn)
  assert(tfsn.date, _ as Date)
  expect(tfsn.date instanceof Date).toBe(true)
  expect(+tfsn.date).toBe(2000)
})

test("prop with transform and can be null | undefined", () => {
  @model("pwt/Tundefined")
  class T extends Model({
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

  const tsn = getSnapshot(t)
  assert(tsn.date, _ as number | null | undefined)
  const tfsn = fromSnapshot<T>(tsn)
  assert(tfsn.date, _ as Date | null | undefined)
  expect(tfsn.date).toBe(undefined)
})

test("prop with transform and can be null", () => {
  @model("pwt/tTundefined")
  class T extends Model({
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

  const tsn = getSnapshot(t)
  assert(tsn.date, _ as number | null)
  const tfsn = fromSnapshot<T>(tsn)
  assert(tfsn.date, _ as Date | null)
  expect(tfsn.date).toBe(null)
})

test("prop with obj->map transform", () => {
  @model("obj->map")
  class T extends Model({
    map: tProp(types.record(types.number)).withSetter().withTransform(objectToMapTransform()),
  }) {
    @modelAction
    setNumberObj(obj: Record<string, number>) {
      this.$.map = obj
    }
  }

  const map1 = new Map([["a", 1]])
  const map2 = new Map([["b", 2]])

  const t = new T({
    map: map1,
  })

  assert(t.map, _ as Map<string, number>)
  expect(t.map.get("a")).toBe(1)
  expect(t.map).not.toBe(map1) // should not be cached
  expect(t.map).toBe(t.map) // should be cached

  assert(t.$.map, _ as Record<string, number>)
  expect(t.$.map).toEqual({ a: 1 })

  runUnprotected(() => {
    t.map.set("c", 3)
  })
  expect(t.map.get("c")).toBe(3)
  expect(t.$.map).toEqual({ a: 1, c: 3 })

  runUnprotected(() => {
    t.$.map.d = 4
  })
  expect(t.map.get("d")).toBe(4)
  expect(t.$.map).toEqual({ a: 1, c: 3, d: 4 })

  t.setMap(map2)

  assert(t.map, _ as Map<string, number>)
  expect(t.map.get("b")).toBe(2)
  expect(t.map).not.toBe(map2) // should not be cached
  expect(t.map).toBe(t.map) // should be cached
  expect(t.$.map).toEqual({ b: 2 })

  const tsn = getSnapshot(t)
  assert(tsn.map, _ as Record<string, number>)
  const tfsn = fromSnapshot<T>(tsn)
  assert(tfsn.map, _ as Map<string, number>)
  expect(t.$.map).toEqual({ b: 2 })

  t.setNumberObj({ d: 4 })
  expect(t.map.get("d")).toBe(4)
  expect(t.$.map).toEqual({ d: 4 })
  expect(t.map).toBe(t.map) // should be cached
})

test("prop with arr->map transform", () => {
  @model("arr->map")
  class T extends Model({
    map: tProp(types.array(types.tuple(types.string, types.number)))
      .withSetter()
      .withTransform(arrayToMapTransform()),
  }) {
    @modelAction
    setNumberArr(arr: Array<[string, number]>) {
      this.$.map = arr
    }
  }

  const map1 = new Map([["a", 1]])
  const map2 = new Map([["b", 2]])

  const t = new T({
    map: map1,
  })

  assert(t.map, _ as Map<string, number>)
  expect(t.map.get("a")).toBe(1)
  expect(t.map).not.toBe(map1) // should not be cached
  expect(t.map).toBe(t.map) // should be cached

  assert(t.$.map, _ as Array<[string, number]>)
  expect(t.$.map).toEqual([["a", 1]])

  runUnprotected(() => {
    t.map.set("c", 3)
  })
  expect(t.map.get("c")).toBe(3)
  expect(t.$.map).toEqual([
    ["a", 1],
    ["c", 3],
  ])

  runUnprotected(() => {
    t.$.map.push(["d", 4])
  })
  expect(t.map.get("d")).toBe(4)
  expect(t.$.map).toEqual([
    ["a", 1],
    ["c", 3],
    ["d", 4],
  ])

  t.setMap(map2)

  assert(t.map, _ as Map<string, number>)
  expect(t.map.get("b")).toBe(2)
  expect(t.map).not.toBe(map2) // should not be cached
  expect(t.map).toBe(t.map) // should be cached
  expect(t.$.map).toEqual([["b", 2]])

  const tsn = getSnapshot(t)
  assert(tsn.map, _ as Array<[string, number]>)
  const tfsn = fromSnapshot<T>(tsn)
  assert(tfsn.map, _ as Map<string, number>)
  expect(t.$.map).toEqual([["b", 2]])

  t.setNumberArr([["d", 4]])
  expect(t.map.get("d")).toBe(4)
  expect(t.$.map).toEqual([["d", 4]])
  expect(t.map).toBe(t.map) // should be cached
})

test("prop with arr->set transform", () => {
  @model("arr->set")
  class T extends Model({
    set: tProp(types.array(types.number)).withSetter().withTransform(arrayToSetTransform()),
  }) {
    @modelAction
    setNumberArr(arr: Array<number>) {
      this.$.set = arr
    }
  }

  const set1 = new Set([1])
  const set2 = new Set([2])

  const t = new T({
    set: set1,
  })

  assert(t.set, _ as Set<number>)
  expect(t.set.has(1)).toBe(true)
  expect(t.set).not.toBe(set1) // should not be cached
  expect(t.set).toBe(t.set) // should be cached

  assert(t.$.set, _ as Array<number>)
  expect(t.$.set).toEqual([1])

  runUnprotected(() => {
    t.set.add(3)
  })
  expect(t.set.has(3)).toBe(true)
  expect(t.$.set).toEqual([1, 3])

  runUnprotected(() => {
    t.$.set.push(4)
  })
  expect(t.set.has(4)).toBe(true)
  expect(t.$.set).toEqual([1, 3, 4])

  t.setSet(set2)

  assert(t.set, _ as Set<number>)
  expect(t.set.has(2)).toBe(true)
  expect(t.set).not.toBe(set2) // should not be cached
  expect(t.set).toBe(t.set) // should be cached
  expect(t.$.set).toEqual([2])

  const tsn = getSnapshot(t)
  assert(tsn.set, _ as Array<number>)
  const tfsn = fromSnapshot<T>(tsn)
  assert(tfsn.set, _ as Set<number>)
  expect(t.$.set).toEqual([2])

  t.setNumberArr([4])
  expect(t.set.has(4)).toBe(true)
  expect(t.$.set).toEqual([4])
  expect(t.set).toBe(t.set) // should be cached
})

@model("MyApp/Point")
class Point extends Model({
  x: prop<number>(),
  y: prop<number>(),
}) {
  get sum() {
    return this.x + this.y
  }
}

// note how ExtendedModel is used
@model("MyApp/Point3d")
class Point3d extends ExtendedModel(Point, {
  z: prop<number>(),
}) {
  get sum() {
    return super.sum + this.z
  }
}
