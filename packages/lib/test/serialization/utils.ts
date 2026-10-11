import { CallError } from "../../src"

export function catchCallError(fn: () => unknown): CallError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(CallError)
    return e as CallError
  }
  throw new Error("expected a throw")
}
