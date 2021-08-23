import { computed, reaction } from "mobx"
import { asSet, Model, model, modelAction, prop, runUnprotected, setToArray } from "../../src"
import "../commonSetup"

test("asSet", () => {
  @model(test.name)
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

  expect(setToArray(m.set)).toEqual([1, 2, 3, 4])
  expect(setToArray(m.set)).toBe(m.arr) // same as backed prop

  m.setSet(new Set([5, 6, 7]))
  expect(m.set).not.toBe(s) // should be a new one
  expect(setToArray(m.set)).toEqual([5, 6, 7])

  runUnprotected(() => {
    m.arr.push(8)
    expect(m.set.has(8)).toBe(true)
  })
})
