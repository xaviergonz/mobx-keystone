import { observable } from "mobx"
import { deserializeActionCallArgument, serializeActionCallArgument } from "../../../src"

test("observable sets survive JSON action-argument serialization", () => {
  const source = observable.set([1, 2, Number.NaN], { deep: false })
  const serialized = serializeActionCallArgument(source)
  const restored = deserializeActionCallArgument(JSON.parse(JSON.stringify(serialized)))
  expect(restored).toBeInstanceOf(Set)
  expect([...restored]).toEqual([1, 2, Number.NaN])
})
