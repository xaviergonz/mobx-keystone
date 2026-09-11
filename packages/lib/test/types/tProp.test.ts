import { Model, tProp, types } from "../../src"
import { testModel } from "../utils"

test("typed property defaults support NaN", () => {
  @testModel("TypedNaNDefaults")
  class Store extends Model({
    value: tProp(types.number, Number.NaN),
    other: tProp(types.number, 1),
  }) {}
  const root = new Store({})
  expect(root.value).toBeNaN()
  expect(root.other).toBe(1)
})
