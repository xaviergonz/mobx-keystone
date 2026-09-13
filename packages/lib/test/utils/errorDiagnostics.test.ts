import { buildErrorMessageWithDiagnostics } from "../../src/utils/errorDiagnostics"

test("diagnostics survive values that reject every string conversion", () => {
  const value = new Proxy(
    {},
    {
      get() {
        throw new Error("cannot inspect")
      },
    }
  )
  const message = buildErrorMessageWithDiagnostics({
    message: "original error",
    path: ["field"],
    previewValue: value,
  })
  expect(message).toContain("original error")
  expect(message).toContain("/field")
})
