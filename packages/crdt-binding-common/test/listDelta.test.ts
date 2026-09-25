import { observable, observe } from "mobx"
import { applyListDeltaToArray, applyListDeltaToSnapshot, commonPathPrefix } from "../src"

const delta = [{ retain: 1 }, { delete: 2 }, { insert: [7, 8, 9] }, { retain: 1 }, { delete: 1 }]

test("list deltas build the final snapshot, retaining unchanged values", () => {
  const retained = { a: 1 }
  const result = applyListDeltaToSnapshot([retained, 2, 3, 4, 5, 6], delta, (v) => v)
  expect(result).toEqual([retained, 7, 8, 9, 4, 6])
  expect(result[0]).toBe(retained)
})

test("list deltas apply one splice per edited range to arrays", () => {
  const target = observable.array([1, 2, 3, 4, 5, 6], { deep: false })
  const splices: unknown[] = []
  observe(target, (change) => {
    splices.push(change.type)
  })
  applyListDeltaToArray(target, delta, (v) => (v as number) * 10)
  expect(target.slice()).toEqual([1, 70, 80, 90, 4, 6])
  expect(splices).toEqual(["splice", "splice"])
})

test("common path prefix", () => {
  expect(commonPathPrefix([])).toBeUndefined()
  expect(commonPathPrefix([["a", 1, "b"]])).toEqual(["a", 1, "b"])
  expect(
    commonPathPrefix([
      ["a", 1, "b"],
      ["a", 1, "c"],
      ["a", 1],
    ])
  ).toEqual(["a", 1])
  expect(commonPathPrefix([["a"], ["b"]])).toEqual([])
})
