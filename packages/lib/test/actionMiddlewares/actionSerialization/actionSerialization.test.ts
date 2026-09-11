import {
  cannotSerialize,
  deserializeActionCallArgument,
  registerActionCallArgumentSerializer,
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
