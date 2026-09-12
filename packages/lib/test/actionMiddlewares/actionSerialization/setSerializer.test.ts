import { observable } from "mobx"
import { deserializeActionCallArgument, serializeActionCallArgument } from "../../../src"

test("observable sets survive JSON action-argument serialization", () => {
  const source = observable.set([1, 2, Number.NaN], { deep: false })
  const serialized = serializeActionCallArgument(source)
  const restored = deserializeActionCallArgument(JSON.parse(JSON.stringify(serialized)))
  expect(restored).toBeInstanceOf(Set)
  expect([...restored]).toEqual([1, 2, Number.NaN])
})

test("serialization closes a set iterator when an element cannot be serialized", () => {
  let closed = false
  const set = new Set([Symbol("unsupported")])
  set.keys = function* () {
    try {
      yield* this.values()
    } finally {
      closed = true
    }
    return undefined
  }
  expect(() => serializeActionCallArgument(set)).toThrow()
  expect(closed).toBe(true)
})
