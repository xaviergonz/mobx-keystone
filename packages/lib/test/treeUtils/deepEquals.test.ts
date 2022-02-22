import { action, observable } from "mobx"
import { clone, deepEquals, runUnprotected } from "../../src"
import { createP } from "../testbed"

test("plain values", () => {
  // no need to check these too much since it uses fast-deep-equals for this
  expect(deepEquals(1, 1)).toBe(true)
  expect(deepEquals(1, 2)).toBe(false)

  expect(deepEquals("1", "1")).toBe(true)
  expect(deepEquals("1", "2")).toBe(false)

  expect(deepEquals([1, 2], [1, 2])).toBe(true)
  expect(deepEquals([1, 2], [1, 1])).toBe(false)

  expect(deepEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
  expect(deepEquals({ a: 1, b: 2 }, { a: 1, b: 1 })).toBe(false)

  expect(deepEquals(new Set([1, 2]), new Set([1, 2]))).toBe(true)
  expect(deepEquals(new Set([1, 2]), new Set([1, 1]))).toBe(false)

  expect(deepEquals(new Map([[1, 2]]), new Map([[1, 2]]))).toBe(true)
  expect(deepEquals(new Map([[1, 2]]), new Map([[1, 1]]))).toBe(false)
})

test(
  "observable values",
  action(() => {
    expect(deepEquals(observable.box(1), observable.box(1))).toBe(true)
    expect(deepEquals(observable.box(1), observable.box(2))).toBe(false)

    expect(deepEquals(observable.box(1), 1)).toBe(true)
    expect(deepEquals(observable.box(1), 2)).toBe(false)

    expect(deepEquals(observable.array([1, 2]), observable.array([1, 2]))).toBe(true)
    expect(deepEquals(observable.array([1, 2]), observable.array([1, 1]))).toBe(false)

    expect(deepEquals(observable.array([1, 2]), [1, 2])).toBe(true)
    expect(deepEquals(observable.array([1, 2]), [1, 1])).toBe(false)

    expect(deepEquals(observable.object({ a: 1, b: 2 }), observable.object({ a: 1, b: 2 }))).toBe(
      true
    )
    expect(deepEquals(observable.object({ a: 1, b: 2 }), observable.object({ a: 1, b: 1 }))).toBe(
      false
    )

    expect(deepEquals(observable.object({ a: 1, b: 2 }), { a: 1, b: 2 })).toBe(true)
    expect(deepEquals(observable.object({ a: 1, b: 2 }), { a: 1, b: 1 })).toBe(false)

    expect(deepEquals(observable.set([1, 2]), observable.set([1, 2]))).toBe(true)
    expect(deepEquals(observable.set([1, 2]), observable.set([1, 1]))).toBe(false)

    expect(deepEquals(observable.set([1, 2]), new Set([1, 2]))).toBe(true)
    expect(deepEquals(observable.set([1, 2]), new Set([1, 1]))).toBe(false)

    expect(deepEquals(observable.map([[1, 2]]), observable.map([[1, 2]]))).toBe(true)
    expect(deepEquals(observable.map([[1, 2]]), observable.map([[1, 1]]))).toBe(false)

    expect(deepEquals(observable.map([[1, 2]]), new Map([[1, 2]]))).toBe(true)
    expect(deepEquals(observable.map([[1, 2]]), new Map([[1, 1]]))).toBe(false)
  })
)

test("nodes", () => {
  const p1 = createP(true)
  const p2 = createP(true)
  const p1Clone = clone(p1, { generateNewIds: false })

  expect(p1.$modelId).not.toBe(p2.$modelId)
  expect(deepEquals(p1, p2)).toBe(false) // false since model ids are different

  expect(p1.$modelId).toBe(p1Clone.$modelId)
  expect(deepEquals(p1, p1Clone)).toBe(true)

  runUnprotected(() => {
    p1Clone.arr.push(4)
  })
  expect(deepEquals(p1, p1Clone)).toBe(false)

  runUnprotected(() => {
    p1Clone.arr.pop()
  })
  expect(deepEquals(p1, p1Clone)).toBe(true)
})
