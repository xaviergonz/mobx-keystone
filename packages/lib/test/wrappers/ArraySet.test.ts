import { reaction, toJS } from "mobx"
import { ArraySet, arraySet, detach } from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

let arr!: ArraySet<number>["items"]
let set!: ArraySet<number>

beforeEach(() => {
  set = arraySet([2, 3, 5])
  arr = set.items
})

function expectSetValues(vals: number[]) {
  expect(toJS(arr)).toEqual(vals)
  expect([...set.values()]).toEqual(vals)
  expect([...set.keys()]).toEqual(vals)
  expect([...set.entries()]).toEqual(vals.map((v) => [v, v]))
  expect([...set]).toEqual(vals)
  vals.forEach((v) => {
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
  set.forEach(function (this: any, t1, t2, s) {
    expect(this).toBe(self)
    expect(t1).toBe(t2)
    v.push(t1)
    expect(s).toBe(set)
  }, self)
  expect(v).toEqual(toJS(arr))
})

test("has", () => {
  expect(set.has(3)).toBe(true)
  expect(set.has(300)).toBe(false)
})

test("reactivity", () => {
  const k = jest.fn()
  autoDispose(reaction(() => set.keys(), k))

  const v = jest.fn()
  autoDispose(reaction(() => set.values(), v))

  const e = jest.fn()
  autoDispose(reaction(() => set.entries(), e))

  const i = jest.fn()
  autoDispose(reaction(() => [...set], i))

  const s = jest.fn()
  autoDispose(reaction(() => set.size, s))

  const h = jest.fn()
  autoDispose(reaction(() => set.has(3), h))

  expect(k).toHaveBeenCalledTimes(0)
  expect(v).toHaveBeenCalledTimes(0)
  expect(e).toHaveBeenCalledTimes(0)
  expect(i).toHaveBeenCalledTimes(0)
  expect(s).toHaveBeenCalledTimes(0)
  expect(h).toHaveBeenCalledTimes(0)

  // add already added
  set.add(5)
  expect(k).toHaveBeenCalledTimes(0)
  expect(v).toHaveBeenCalledTimes(0)
  expect(e).toHaveBeenCalledTimes(0)
  expect(i).toHaveBeenCalledTimes(0)
  expect(s).toHaveBeenCalledTimes(0)
  expect(h).toHaveBeenCalledTimes(0)
  jest.resetAllMocks()

  // add
  set.add(10)
  expect(k).toHaveBeenCalledTimes(1)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(1)
  expect(h).toHaveBeenCalledTimes(0)
  jest.resetAllMocks()

  // delete
  set.delete(3)
  expect(k).toHaveBeenCalledTimes(1)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(1)
  expect(h).toHaveBeenCalledTimes(1)
  jest.resetAllMocks()
})

test("detach", () => {
  const arr = arraySet<{ x: number }>([{ x: 2 }, { x: 3 }, { x: 5 }])
  const three = Array.from(arr.values()).find((i) => i.x === 3)!
  detach(three)
  expect(Array.from(arr.values()).map((i) => i.x)).toEqual([2, 5])
})
