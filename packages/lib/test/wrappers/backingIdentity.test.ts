import { observable, runInAction } from "mobx"
import { asMap, asSet } from "../../src"

test.each([false, true])("asSet shares backing values with deep=%s", (deep) => {
  const original = { value: 1 }
  const array = observable.array([original], { deep })
  const set = asSet(array)
  expect([...set][0]).toBe(array[0])
  runInAction(() => {
    set.add({ value: 2 })
    expect([...set][1]).toBe(array[1])
    expect(set.delete(array[1])).toBe(true)
    expect(array.length).toBe(1)
  })
})

test.each([false, true])("object-backed asMap shares values with deep=%s", (deep) => {
  const object = observable.object({ a: { value: 1 } }, undefined, { deep })
  const map = asMap(object)
  expect(map.get("a")).toBe(object.a)
  runInAction(() => {
    map.set("a", { value: 2 })
    expect(map.get("a")).toBe(object.a)
  })
})

test.each([false, true])("array-backed asMap shares values with deep=%s", (deep) => {
  const array = observable.array<[string, { value: number }]>([["a", { value: 1 }]], { deep })
  const map = asMap(array)
  expect(map.get("a")).toBe(array[0][1])
  runInAction(() => {
    map.set("a", { value: 2 })
    expect(map.get("a")).toBe(array[0][1])
    map.set("b", { value: 3 })
    expect(map.get("b")).toBe(array[1][1])
  })
})
