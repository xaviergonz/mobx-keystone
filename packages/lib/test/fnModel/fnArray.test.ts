import { fnArray } from "../../src"
import "../commonSetup"

test("typed array", () => {
  const arr = fnArray.create([1, 2])
  expect(arr[0]).toBe(1)
  expect(arr.length).toBe(2)

  fnArray.set(arr, 0, 3)
  expect(arr[0]).toBe(3)

  fnArray.delete(arr, 0)
  expect(arr[0]).toBe(2)
  expect(arr.length).toBe(1)
})

test("untyped array", () => {
  const arr = fnArray.create<any>([1, 2])
  expect(arr[0]).toBe(1)
  expect(arr.length).toBe(2)

  fnArray.set(arr, 0, "3")
  expect(arr[0]).toBe("3")

  fnArray.delete(arr, 0)
  expect(arr[0]).toBe(2)
  expect(arr.length).toBe(1)
})
