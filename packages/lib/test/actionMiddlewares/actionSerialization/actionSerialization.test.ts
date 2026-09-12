import {
  cannotSerialize,
  deserializeActionCallArgument,
  MobxKeystoneError,
  registerActionCallArgumentSerializer,
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
