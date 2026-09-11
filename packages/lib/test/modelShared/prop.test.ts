import { Model, prop } from "../../src"
import { toFullModelPropTransform } from "../../src/modelShared/prop"
import { testModel } from "../utils"

test("prop defaults support NaN", () => {
  @testModel("NaNDefaults")
  class Store extends Model({ value: prop(Number.NaN), other: prop(1) }) {}
  const root = new Store({})
  expect(root.value).toBeNaN()
  expect(root.other).toBe(1)
})

test("transform caching retains NaN", () => {
  const full = toFullModelPropTransform({
    transform: ({ originalValue, cachedTransformedValue }) =>
      cachedTransformedValue ?? { value: originalValue },
    untransform: ({ transformedValue }) => transformedValue,
  })
  const root = {}
  const read = (value: number) =>
    full.transform(value, root, "value", () => {}) as { value: number }
  expect(read(0).value).toBe(0)
  const nan = read(Number.NaN)
  expect(read(Number.NaN)).toBe(nan)
})

test.each([true, false])(
  "nested transforms do not overwrite the outer cache choice %s",
  (cacheOuter) => {
    const root = {}
    const inner = toFullModelPropTransform({
      transform: () => undefined,
      untransform: ({ cacheTransformedValue }) => {
        if (!cacheOuter) cacheTransformedValue()
        return 1
      },
    })
    const outer = toFullModelPropTransform({
      transform: ({ cachedTransformedValue }) => cachedTransformedValue,
      untransform: ({ cacheTransformedValue }) => {
        if (cacheOuter) cacheTransformedValue()
        inner.untransform({}, root, "inner")
        return 1
      },
    })
    const value = {}
    outer.untransform(value, root, "outer")
    expect(outer.transform(1, root, "outer", () => {})).toBe(cacheOuter ? value : undefined)
  }
)
