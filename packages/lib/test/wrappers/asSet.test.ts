import { computed, intercept, observable, observe, reaction, runInAction, toJS } from "mobx"
import { asSet, Model, modelAction, prop, runUnprotected, setToArray } from "../../src"
import { testModel } from "../utils"

test("adding an existing value does not duplicate the backing entry", () => {
  const array = observable.array([1, Number.NaN, 0])
  const set = asSet(array)
  runInAction(() => {
    expect(set.add(1)).toBe(set)
    set.add(Number.NaN)
    set.add(-0)
    expect(set.size).toBe(3)
    expect(array.slice()).toEqual([1, Number.NaN, 0])
    set.clear()
    expect(array.slice()).toEqual([])
  })
})

test("deleting NaN keeps the backing array synchronized", () => {
  const array = observable.array([1, Number.NaN, 2])
  const set = asSet(array)
  runInAction(() => {
    expect(set.delete(Number.NaN)).toBe(true)
    expect(set.has(Number.NaN)).toBe(false)
    expect(array.slice()).toEqual([1, 2])
    set.add(Number.NaN)
    expect(array.slice()).toEqual([1, 2, Number.NaN])
    expect(set.delete(Number.NaN)).toBe(true)
    expect(set.delete(Number.NaN)).toBe(false)
    expect(array.slice()).toEqual([1, 2])
  })
})

test("asSet", () => {
  @testModel("M")
  class M extends Model({
    arr: prop<number[]>(() => [1, 2, 3]),
  }) {
    @computed
    get set() {
      return asSet(this.arr)
    }

    @modelAction
    add(n: number) {
      this.set.add(n)
    }

    @modelAction
    setSet(set: Set<number>) {
      this.arr = setToArray(set)
    }
  }

  const m = new M({})

  reaction(
    () => m.set,
    () => {}
  )

  // should not change
  const s = m.set
  expect(m.set).toBe(s)

  // adding
  expect(m.set.has(1)).toBe(true)
  expect(m.set.has(4)).toBe(false)
  m.add(4)
  expect(m.set.has(4)).toBe(true)

  expect(toJS(setToArray(m.set))).toEqual([1, 2, 3, 4])
  expect(setToArray(m.set)).toBe(m.arr) // same as backed prop

  m.setSet(new Set([5, 6, 7]))
  expect(m.set).not.toBe(s) // should be a new one
  expect(toJS(setToArray(m.set))).toEqual([5, 6, 7])

  runUnprotected(() => {
    m.arr.push(8)
    expect(m.set.has(8)).toBe(true)
  })
})

test.each(["add", "delete"])("array-backed sets respect canceled %s changes", (operation) => {
  const backing = observable.array([1])
  const set = asSet(backing)
  const onChange = vi.fn()
  const stopObserving = observe(set, onChange)
  const stop = intercept(backing, () => null)
  try {
    runInAction(() => {
      if (operation === "delete") expect(set.delete(1)).toBe(false)
      else set.add(2)
    })
    expect(Array.from(set)).toEqual([1])
    expect(backing.slice()).toEqual([1])
    expect(onChange).not.toHaveBeenCalled()
  } finally {
    stop()
    stopObserving()
  }
  runInAction(() => {
    set.add(2)
    expect(set.delete(1)).toBe(true)
  })
  expect(Array.from(set)).toEqual([2])
  expect(backing.slice()).toEqual([2])
})

test("array-backed sets respect canceled additions to an empty array", () => {
  const backing = observable.array<number>([])
  const set = asSet(backing)
  const onChange = vi.fn()
  const stopObserving = observe(set, onChange)
  const stop = intercept(backing, () => null)
  try {
    runInAction(() => set.add(2))
    expect(Array.from(set)).toEqual([])
    expect(backing.slice()).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  } finally {
    stop()
    stopObserving()
  }
})
