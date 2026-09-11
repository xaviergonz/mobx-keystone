import { getOrCreate } from "../../src/utils/mapUtils"

test("getOrCreate requires created values to fit the map value type", () => {
  const map = new Map<string, number>()
  expect(getOrCreate(map, "valid", () => 1)).toBe(1)
  void (() => {
    // @ts-expect-error a string cannot be inserted into a map of numbers
    getOrCreate(map, "invalid", () => "wrong")
  })
})

test.each([new Map<object, undefined>(), new WeakMap<object, undefined>()])(
  "getOrCreate caches undefined values",
  (map) => {
    const key = {}
    const create = vi.fn(() => undefined)
    getOrCreate(map, key, create)
    getOrCreate(map, key, create)
    expect(create).toHaveBeenCalledOnce()
  }
)
