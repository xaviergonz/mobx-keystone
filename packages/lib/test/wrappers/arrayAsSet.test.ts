import { arrayAsSet } from "../../src"
import "../commonSetup"

let arr!: number[]
let set!: Set<number>

beforeEach(() => {
  arr = [2, 3, 5]
  set = arrayAsSet(() => arr)
})

function expectSetValues(vals: number[]) {
  expect(arr).toEqual(vals)
  expect([...set.values()]).toEqual(vals)
  expect([...set.keys()]).toEqual(vals)
  expect([...set.entries()]).toEqual(vals.map(v => [v, v]))
  expect([...set]).toEqual(vals)
  vals.forEach(v => {
    expect(set.has(v)).toBe(true)
  })
  expect(set.size).toBe(vals.length)
}

test("add", () => {
  set.add(3)
  expectSetValues([2, 3, 5])

  set.add(1)
  expectSetValues([2, 3, 5, 1])
})

test("clear", () => {
  set.clear()
  expectSetValues([])
})

test("delete", () => {
  expect(set.delete(100)).toBe(false)
  expectSetValues([2, 3, 5])
  expect(set.delete(3)).toBe(true)
  expectSetValues([2, 5])
})

test("forEach", () => {
  let v: number[] = []
  const self = {}
  set.forEach(function(this: any, t1, t2, s) {
    expect(this).toBe(self)
    expect(t1).toBe(t2)
    v.push(t1)
    expect(s).toBe(set)
  }, self)
  expect(v).toEqual(arr)
})

test("has", () => {
  expect(set.has(3)).toBe(true)
  expect(set.has(300)).toBe(false)
})
