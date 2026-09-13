import {
  cannotSerialize,
  deserializeActionCall,
  deserializeActionCallArgument,
  MobxKeystoneError,
  registerActionCallArgumentSerializer,
  serializeActionCall,
  serializeActionCallArgument,
} from "../../../src"

test("an old serializer disposer cannot unregister a later registration", () => {
  const serializer = {
    id: "test/lifecycle",
    serialize: () => cannotSerialize,
    deserialize: () => "restored",
  }
  const oldDispose = registerActionCallArgumentSerializer(serializer)
  oldDispose()
  const dispose = registerActionCallArgumentSerializer(serializer)
  try {
    oldDispose()
    expect(
      deserializeActionCallArgument({ $mobxKeystoneSerializer: serializer.id, value: null })
    ).toBe("restored")
  } finally {
    dispose()
  }
})

test("a serializer disposing itself does not skip the next serializer", () => {
  const value = Symbol("custom")
  const disposeFallback = registerActionCallArgumentSerializer({
    id: "review/fallback",
    serialize: (v) => (v === value ? "matched" : cannotSerialize),
    deserialize: () => value,
  })
  const disposeFirst = registerActionCallArgumentSerializer({
    id: "review/self-disposing",
    serialize() {
      disposeFirst()
      return cannotSerialize
    },
    deserialize: () => undefined,
  })
  try {
    expect(deserializeActionCallArgument(serializeActionCallArgument(value))).toBe(value)
  } finally {
    disposeFirst()
    disposeFallback()
  }
})

test.each([Symbol("unsupported"), () => undefined])(
  "unsupported values report library serialization errors",
  (value) => {
    expect(() => serializeActionCallArgument(value)).toThrow(MobxKeystoneError)
  }
)

test("serializer disposal uses its original registered ID", () => {
  const first = {
    id: "mutable/first",
    serialize: () => cannotSerialize,
    deserialize: () => "first",
  }
  const second = {
    id: "mutable/second",
    serialize: () => cannotSerialize,
    deserialize: () => "second",
  }
  const disposeFirst = registerActionCallArgumentSerializer(first)
  const disposeSecond = registerActionCallArgumentSerializer(second)
  try {
    first.id = second.id
    disposeFirst()
    expect(deserializeActionCallArgument({ $mobxKeystoneSerializer: second.id, value: null })).toBe(
      "second"
    )
    expect(() =>
      deserializeActionCallArgument({ $mobxKeystoneSerializer: "mutable/first", value: null })
    ).toThrow()
  } finally {
    first.id = "mutable/first"
    disposeFirst()
    disposeSecond()
  }
})

test("sparse top-level action arguments survive JSON round trips", () => {
  const args = new Array(2)
  args[1] = "second"
  const serialized = serializeActionCall({
    actionName: "test",
    args,
    targetPath: [],
    targetPathIds: [],
  })
  const restored = deserializeActionCall(JSON.parse(JSON.stringify(serialized)))
  expect(restored.args).toEqual([undefined, "second"])
})

test("unprintable unsupported action arguments retain the serialization error", () => {
  class Unprintable {
    toString() {
      throw new Error("coercion failed")
    }
  }
  expect(() => serializeActionCallArgument(new Unprintable())).toThrow(MobxKeystoneError)
})
