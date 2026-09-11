import { deserializeActionCallArgument, serializeActionCallArgument } from "../../../src"

const roundTrip = (value: unknown) =>
  deserializeActionCallArgument(
    JSON.parse(JSON.stringify(serializeActionCallArgument({ value })))
  ) as { value: unknown }

test.each([
  ["NaN", Number.NaN],
  ["+Infinity", Number.POSITIVE_INFINITY],
  ["-Infinity", Number.NEGATIVE_INFINITY],
  ["bigint", 10n],
])("%s survives a JSON action-argument round trip", (_name, value) => {
  expect(roundTrip(value).value).toBe(value)
})

test("signed zero round trips as a single value", () => {
  expect(roundTrip(-0).value).toBe(0)
})
