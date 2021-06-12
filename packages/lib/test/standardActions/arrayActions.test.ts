import { arrayActions, isTreeNode } from "../../src"
import "../commonSetup"

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
