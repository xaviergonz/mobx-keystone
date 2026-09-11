import { fromSnapshot, typeCheck, types } from "../../../src"

test("bigint literals can be constructed and checked", () => {
  const type = types.literal(12n)
  expect(typeCheck(type, 12n)).toBeNull()
  const error = typeCheck(type, 13n as never)
  expect(error?.expectedTypeName).toBe("12n")
})

test("NaN literals match NaN and describe it correctly", () => {
  const type = types.literal(Number.NaN)
  expect(typeCheck(type, Number.NaN)).toBeNull()
  const error = typeCheck(type, 0)
  expect(error?.expectedTypeName).toBe("NaN")
  expect(fromSnapshot(types.or(type, types.literal("other")), Number.NaN)).toBeNaN()
  expect(typeCheck(types.literal(0), -0)).toBeNull()
})
