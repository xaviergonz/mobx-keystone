import { jsonEquals } from "../src"

test("array comparison stops at a differing last element", () => {
  const firstElement = vi.fn(() => 1)
  const left = [1, 2, 3]
  Object.defineProperty(left, 0, { get: firstElement })
  expect(jsonEquals(left, [1, 2, 4])).toBe(false)
  expect(firstElement).not.toHaveBeenCalled()
})

test.each([
  [[], [], true],
  [[1, { value: 2 }], [1, { value: 2 }], true],
  [[1, 2, 3], [4, 2, 3], false],
  [[1], [1, 2], false],
])("array equality compares all required elements: %j and %j", (left, right, expected) => {
  expect(jsonEquals(left, right)).toBe(expected)
})
