import { typeCheck, types } from "../../../src"
import { enumValues } from "../../../src/types/primitiveBased/typesEnum"

test("numeric enums with NaN do not expose reverse mapping names as values", () => {
  const enumObject = { Value: Number.NaN, NaN: "Value" }
  expect(enumValues(enumObject)).toEqual([Number.NaN])
  const type = types.enum(enumObject)
  expect(typeCheck(type, Number.NaN)).toBeNull()
  expect(typeCheck(type, "Value")).not.toBeNull()
  expect(enumValues({ Zero: -0, 0: "Zero" })).toEqual([-0])
})

test("enum aliases retain their first value order", () => {
  expect(
    enumValues({
      0: "Alias",
      1: "Next",
      Zero: 0,
      Alias: 0,
      Next: 1,
      Text: "text",
      OtherText: "text",
    })
  ).toEqual([0, 1, "text"])
})
