import { computed, reaction } from "mobx"
import {
  asMap,
  mapToArray,
  mapToObject,
  Model,
  model,
  modelAction,
  prop,
  runUnprotected,
} from "../../src"

test("asMap - object", () => {
  @model(test.name)
  class M extends Model({
    obj: prop<Record<string, number>>(() => ({ a: 1, b: 2, c: 3 })),
  }) {
    @computed
    get map() {
      return asMap(this.obj)
    }

    @modelAction
    add(s: string, n: number) {
      this.map.set(s, n)
    }

    @modelAction
    setMap(map: Map<string, number>) {
      this.obj = mapToObject(map)
    }
  }

  const m = new M({})

  reaction(
    () => m.map,
    () => {}
  )

  // should not change
  const ma = m.map
  expect(m.map).toBe(ma)

  // adding
  expect(m.map.has("a")).toBe(true)
  expect(m.map.has("d")).toBe(false)
  m.add("d", 4)
  expect(m.map.has("d")).toBe(true)

  expect(mapToObject(m.map)).toEqual({ a: 1, b: 2, c: 3, d: 4 })
  expect(mapToObject(m.map)).toBe(m.obj) // same as backed prop

  m.setMap(new Map([["e", 5]]))
  expect(m.map).not.toBe(ma) // should be a new one
  expect(mapToObject(m.map)).toEqual({ e: 5 })

  runUnprotected(() => {
    m.obj.f = 6
    expect(m.map.get("f")).toBe(6)
  })
})

test("asMap - array", () => {
  @model(test.name)
  class M extends Model({
    arr: prop<Array<[string, number]>>(() => [
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]),
  }) {
    @computed
    get map() {
      return asMap(this.arr)
    }

    @modelAction
    add(s: string, n: number) {
      this.map.set(s, n)
    }

    @modelAction
    setArr(map: Map<string, number>) {
      this.arr = mapToArray(map)
    }
  }

  const m = new M({})

  reaction(
    () => m.map,
    () => {}
  )

  // should not change
  const ma = m.map
  expect(m.map).toBe(ma)

  // adding
  expect(m.map.has("a")).toBe(true)
  expect(m.map.has("d")).toBe(false)
  m.add("d", 4)
  expect(m.map.has("d")).toBe(true)

  expect(mapToArray(m.map)).toEqual([
    ["a", 1],
    ["b", 2],
    ["c", 3],
    ["d", 4],
  ])
  expect(mapToArray(m.map)).toBe(m.arr) // same as backed prop

  m.setArr(new Map([["e", 5]]))
  expect(m.map).not.toBe(ma) // should be a new one
  expect(mapToArray(m.map)).toEqual([["e", 5]])

  runUnprotected(() => {
    m.arr.push(["f", 6])
    expect(m.map.get("f")).toBe(6)
  })
})
