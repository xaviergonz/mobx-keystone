import { entries, reaction } from "mobx"
import { ObjectMap, objectMap } from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

let map!: ObjectMap<number>
let obj!: ObjectMap<number>["items"]

beforeEach(() => {
  map = objectMap<number>([["2", 2], ["3", 3], ["5", 5]])
  obj = map.items
})

function expectMapValues(valsN: number[]) {
  const vals = valsN.map(v => ["" + v, v] as const)
  expect(entries(obj)).toEqual(vals)

  expect([...map.values()]).toEqual(vals.map(v => v[1]))
  expect([...map.keys()]).toEqual(vals.map(v => v[0]))
  expect([...map.entries()]).toEqual(vals)
  expect([...map]).toEqual(vals)
  vals.forEach(t => {
    expect(map.has(t[0])).toBe(true)
  })
  expect(map.size).toBe(vals.length)
}

test("set", () => {
  map.set("3", 300)
  expect(map.get("3")).toBe(300)
  map.set("3", 3)
  expectMapValues([2, 3, 5])

  map.set("12", 12)
  expectMapValues([2, 3, 5, 12])
})

test("clear", () => {
  map.clear()
  expectMapValues([])
})

test("delete", () => {
  expect(map.delete("100")).toBe(false)
  expectMapValues([2, 3, 5])
  expect(map.delete("3")).toBe(true)
  expectMapValues([2, 5])
})

test("forEach", () => {
  let a: [string, number][] = []
  const self = {}
  map.forEach(function(this: any, v, k, m) {
    expect(this).toBe(self)
    a.push([k, v])
    expect(m).toBe(map)
  }, self)
  expect(a).toEqual(Object.entries(obj))
})

test("has", () => {
  expect(map.has("3")).toBe(true)
  expect(map.has("300")).toBe(false)
})

test("reactivity", () => {
  const k = jest.fn()
  autoDispose(reaction(() => map.keys(), k))

  const v = jest.fn()
  autoDispose(reaction(() => map.values(), v))

  const e = jest.fn()
  autoDispose(reaction(() => map.entries(), e))

  const i = jest.fn()
  autoDispose(reaction(() => [...map], i))

  const s = jest.fn()
  autoDispose(reaction(() => map.size, s))

  const h = jest.fn()
  autoDispose(reaction(() => map.has("3"), h))

  expect(k).toHaveBeenCalledTimes(0)
  expect(v).toHaveBeenCalledTimes(0)
  expect(e).toHaveBeenCalledTimes(0)
  expect(i).toHaveBeenCalledTimes(0)
  expect(s).toHaveBeenCalledTimes(0)
  expect(h).toHaveBeenCalledTimes(0)

  // change
  map.set("5", 7)
  expect(k).toHaveBeenCalledTimes(0)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(0)
  expect(h).toHaveBeenCalledTimes(0)
  jest.resetAllMocks()

  // add
  map.set("10", 10)
  expect(k).toHaveBeenCalledTimes(1)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(1)
  expect(h).toHaveBeenCalledTimes(0)
  jest.resetAllMocks()

  // delete
  map.delete("3")
  expect(k).toHaveBeenCalledTimes(1)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(1)
  expect(h).toHaveBeenCalledTimes(1)
  jest.resetAllMocks()
})
