import { arrayAsMap } from "../../src"
import "../commonSetup"

let arr!: [string, number][]
let map!: Map<string, number>

beforeEach(() => {
  arr = [["2", 2], ["3", 3], ["5", 5]]
  map = arrayAsMap<number>(() => arr)
})

function expectMapValues(valsN: number[]) {
  const vals = valsN.map(v => ["" + v, v] as const)
  expect(arr).toEqual(vals)
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

  map.set("1", 1)
  expectMapValues([2, 3, 5, 1])
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
  expect(a).toEqual(arr)
})

test("has", () => {
  expect(map.has("3")).toBe(true)
  expect(map.has("300")).toBe(false)
})
