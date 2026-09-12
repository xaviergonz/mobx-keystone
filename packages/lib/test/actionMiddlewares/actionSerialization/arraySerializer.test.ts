import { deserializeActionCallArgument, serializeActionCallArgument } from "../../../src"

test("sparse action arrays preserve undefined values through JSON", () => {
  const values = new Array(3)
  values[1] = 1
  const restored = deserializeActionCallArgument(
    JSON.parse(JSON.stringify(serializeActionCallArgument(values)))
  )
  expect(Array.from(restored)).toEqual([undefined, 1, undefined])
})
