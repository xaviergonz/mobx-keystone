import { toJS } from "mobx"
import { _, assert } from "spec.ts"
import { arrayActions, isTreeNode, patchRecorder, toTreeNode } from "../../src"

test.each([0, 1, 2])("swapping index %s with itself leaves the array unchanged", (index) => {
  const arr = arrayActions.create([1, 2, 3])
  const recorder = patchRecorder(arr)
  expect(arrayActions.swap(arr, index, index)).toBe(true)
  expect(toJS(arr)).toEqual([1, 2, 3])
  expect(recorder.events).toEqual([])
  recorder.dispose()
})

test.each([Number.NaN, 0.5, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  "swap rejects invalid index %s",
  (index) => {
    const arr = arrayActions.create([1, 2, 3])
    expect(arrayActions.swap(arr, index, 1)).toBe(false)
    expect(arrayActions.swap(arr, 1, index)).toBe(false)
    expect(toJS(arr)).toEqual([1, 2, 3])
  }
)

test("typed array", () => {
  const arr = arrayActions.create([1, 2])
  expect(isTreeNode(arr)).toBe(true)
  expect(arr[0]).toBe(1)
  expect(arr.length).toBe(2)

  arrayActions.set(arr, 0, 3)
  expect(arr[0]).toBe(3)

  arrayActions.delete(arr, 0)
  expect(arr[0]).toBe(2)
  expect(arr.length).toBe(1)
})

test("untyped array", () => {
  const arr = arrayActions.create<any>([1, 2])
  expect(isTreeNode(arr)).toBe(true)
  expect(arr[0]).toBe(1)
  expect(arr.length).toBe(2)

  arrayActions.set(arr, 0, "3")
  expect(arr[0]).toBe("3")

  arrayActions.delete(arr, 0)
  expect(arr[0]).toBe(2)
  expect(arr.length).toBe(1)
})

test("swap", () => {
  const arr = arrayActions.create([1, 2, 3, 4, 5])
  arrayActions.swap(arr, 1, 3)
  expect(toJS(arr)).toEqual([1, 4, 3, 2, 5])

  arrayActions.swap(arr, -1, 3)
  expect(toJS(arr)).toEqual([1, 4, 3, 2, 5])

  arrayActions.swap(arr, 1, arr.length)
  expect(toJS(arr)).toEqual([1, 4, 3, 2, 5])
})

test("arrayActions.concat accepts scalar items mixed with arrays", () => {
  const source = toTreeNode([1])
  const result = arrayActions.concat(source, 2, [3, 4])
  assert(result, _ as number[])
  expect(result).toEqual([1, 2, 3, 4])
  expect(Array.from(source)).toEqual([1])
})
