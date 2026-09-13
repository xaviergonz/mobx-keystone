import { objectToMapTransform } from "../../src"

test("object-to-map transforms preserve __proto__ entries when encoding", () => {
  const transform = objectToMapTransform<number>()
  const stored = transform.untransform({
    transformedValue: new Map([["__proto__", 123]]),
    cacheTransformedValue() {},
  })
  expect(Object.hasOwn(stored, "__proto__")).toBe(true)
  expect(Reflect.get(stored, "__proto__")).toBe(123)
  expect(Object.getPrototypeOf(stored)).toBe(Object.prototype)
})
