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
