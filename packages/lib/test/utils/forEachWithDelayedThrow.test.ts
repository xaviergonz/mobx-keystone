import { MobxKeystoneAggregateError, MobxKeystoneError } from "../../src"
import { forEachWithDelayedThrow } from "../../src/utils/forEachWithDelayedThrow"

test.each([new Error("only"), undefined, null])(
  "runs every callback, then rethrows a lone failure as is: %s",
  (error) => {
    const visited: number[] = []
    let caught: unknown
    let threw = false
    try {
      forEachWithDelayedThrow([1, 2, 3], (item) => {
        visited.push(item)
        if (item === 2) throw error
      })
    } catch (e) {
      threw = true
      caught = e
    }
    expect(threw).toBe(true)
    expect(caught).toBe(error)
    expect(visited).toEqual([1, 2, 3])
  }
)

test.each([new Error("first"), undefined, null])(
  "groups several failures in a MobxKeystoneAggregateError: %s",
  (firstError) => {
    const secondError = new Error("second")
    const visited: number[] = []
    let caught: unknown
    try {
      forEachWithDelayedThrow([1, 2, 3], (item) => {
        visited.push(item)
        if (item === 1) throw firstError
        if (item === 2) throw secondError
      })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(MobxKeystoneAggregateError)
    expect(caught).toBeInstanceOf(MobxKeystoneError)
    expect((caught as MobxKeystoneAggregateError).errors).toEqual([firstError, secondError])
    expect(visited).toEqual([1, 2, 3])
  }
)

test("visits appended items even after a callback throws", () => {
  const items = [1]
  const visited: number[] = []
  const error = new Error("first")
  expect(() =>
    forEachWithDelayedThrow(items, (item) => {
      visited.push(item)
      if (item === 1) {
        items.push(2)
        throw error
      }
    })
  ).toThrow(error)
  expect(visited).toEqual([1, 2])
})

test("returns normally for successful callbacks and empty input", () => {
  const visit = vi.fn()
  expect(forEachWithDelayedThrow([], visit)).toBeUndefined()
  expect(visit).not.toHaveBeenCalled()
  expect(forEachWithDelayedThrow(new Set([1, 2]), visit)).toBeUndefined()
  expect(visit.mock.calls).toEqual([[1], [2]])
})

test("preserves error identity without wrapping", () => {
  const error = new Error("only")
  let caught: unknown
  try {
    forEachWithDelayedThrow([error], (e) => {
      throw e
    })
  } catch (e) {
    caught = e
  }
  expect(caught).toBe(error)
})

test("nested delivery does not wrap a lone original error", () => {
  const error = new Error("inner")
  let caught: unknown
  try {
    forEachWithDelayedThrow([1], () => {
      forEachWithDelayedThrow([1], () => {
        throw error
      })
    })
  } catch (e) {
    caught = e
  }
  expect(caught).toBe(error)
})

test("nested aggregates are flattened into one flat error list", () => {
  const a = new Error("a")
  const b = new Error("b")
  const c = new Error("c")
  let caught: unknown
  try {
    forEachWithDelayedThrow([1, 2], (item) => {
      if (item === 1) {
        // an inner delivery that fails twice
        forEachWithDelayedThrow([a, b], (e) => {
          throw e
        })
      } else {
        throw c
      }
    })
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(MobxKeystoneAggregateError)
  expect((caught as MobxKeystoneAggregateError).errors).toEqual([a, b, c])
})
