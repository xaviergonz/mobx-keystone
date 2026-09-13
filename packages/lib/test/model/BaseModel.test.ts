import { Model, prop } from "../../src"
import { testModel } from "../utils"

@testModel("ModelStringDefaults")
class Item extends Model({ value: prop(2) }) {}

test("undefined withData retains the default model string representation", () => {
  const item = new Item({})
  expect(item.toString()).toContain('"value":2')
  expect(item.toString({ withData: undefined })).toBe(item.toString())
  expect(item.toString({ withData: false })).not.toContain('"value":2')
})
