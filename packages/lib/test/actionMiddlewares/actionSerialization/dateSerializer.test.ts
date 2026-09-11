import { deserializeActionCallArgument, serializeActionCallArgument } from "../../../src"

test("invalid dates survive JSON action-argument round trips", () => {
  const serialized = serializeActionCallArgument(new Date(Number.NaN))
  const restored = deserializeActionCallArgument(JSON.parse(JSON.stringify(serialized))) as Date
  expect(restored).toBeInstanceOf(Date)
  expect(restored.getTime()).toBeNaN()
})
