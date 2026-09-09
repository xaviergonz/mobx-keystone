import { action, observable } from "mobx"
import { clone, deepEquals, idProp, Model, model, prop, runUnprotected } from "../../src"

@model("deepEquals/Nested")
class Nested extends Model({ id: idProp, value: prop(12) }) {}

@model("deepEquals/Node")
class Node extends Model({
  id: idProp,
  arr: prop<number[]>(() => [1, 2, 3]),
  nested: prop<Nested>(),
}) {}

function createNode() {
  return new Node({ nested: new Nested({}) })
}

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
  const p1 = createNode()
  const p2 = createNode()
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

test("primitive fast paths preserve equality and observable unboxing", () => {
  const symbol = Symbol("value")
  for (const value of [undefined, null, true, 1, "value", 1n, symbol, Number.NaN]) {
    expect(deepEquals(value, value)).toBe(true)
    expect(deepEquals(observable.box(value), value)).toBe(true)
    expect(deepEquals(value, observable.box(value))).toBe(true)
  }
  expect(deepEquals(0, -0)).toBe(true)
  expect(deepEquals(Number.NaN, 0)).toBe(false)
  expect(deepEquals(null, undefined)).toBe(false)
  expect(deepEquals(1n, 1)).toBe(false)
  expect(deepEquals(Symbol("value"), Symbol("value"))).toBe(false)
})

test("model data objects retain observable-object comparison semantics", () => {
  const model = createNode()
  const copy = clone(model, { generateNewIds: false })
  expect(deepEquals(model.$, copy.$)).toBe(true)
  runUnprotected(() => {
    copy.arr.push(42)
  })
  expect(deepEquals(model.$, copy.$)).toBe(false)
})

test("non-JSON values retain their existing comparison behavior", () => {
  expect(deepEquals(new Date(1), new Date(1))).toBe(true)
  expect(deepEquals(new Date(1), new Date(2))).toBe(false)
  expect(deepEquals(/value/gi, /value/gi)).toBe(true)
  expect(deepEquals(/value/g, /value/i)).toBe(false)
  expect(deepEquals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
  expect(deepEquals(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
  const fn = () => 1
  expect(deepEquals(fn, fn)).toBe(true)
  expect(deepEquals(fn, () => 1)).toBe(false)
})
