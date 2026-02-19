import {
  buildErrorMessageWithDiagnostics,
  getErrorModelTrailSnapshot,
  getErrorPathSnapshot,
  noErrorValuePreview,
  runWithErrorDiagnosticsContext,
  withErrorModelTrailEntry,
  withErrorPathSegment,
  withErrorPathSegments,
} from "../../src/utils/errorDiagnostics"

test("error diagnostics helpers handle no-context and nested-context usage", () => {
  expect(getErrorPathSnapshot()).toBeUndefined()
  expect(getErrorModelTrailSnapshot()).toBeUndefined()

  expect(withErrorPathSegment("x", () => 1)).toBe(1)
  expect(withErrorPathSegments([], () => 2)).toBe(2)
  expect(withErrorPathSegments(["x"], () => 3)).toBe(3)
  expect(withErrorModelTrailEntry("M", () => 4)).toBe(4)

  runWithErrorDiagnosticsContext(() => {
    withErrorPathSegment("a", () => {
      withErrorPathSegments(["b", "c"], () => {
        withErrorModelTrailEntry("M1", () => {
          withErrorModelTrailEntry("M2", "id-2", () => {
            expect(getErrorPathSnapshot()).toEqual(["a", "b", "c"])
            expect(getErrorModelTrailSnapshot()).toEqual(["M1", 'M2 (id="id-2")'])
          })
        })
      })
      expect(getErrorPathSnapshot()).toEqual(["a"])
      expect(getErrorModelTrailSnapshot()).toBeUndefined()
    })
  })

  expect(getErrorPathSnapshot()).toBeUndefined()
  expect(getErrorModelTrailSnapshot()).toBeUndefined()
})

test("error diagnostics path segments and model trail are restored after exceptions", () => {
  runWithErrorDiagnosticsContext(() => {
    expect(() =>
      withErrorPathSegments(["a", "b"], () => {
        withErrorModelTrailEntry("M", () => {
          throw new Error("boom")
        })
      })
    ).toThrow("boom")

    expect(getErrorPathSnapshot()).toEqual([])
    expect(getErrorModelTrailSnapshot()).toBeUndefined()
  })
})

test("buildErrorMessageWithDiagnostics handles value preview edge cases", () => {
  const noPreview = buildErrorMessageWithDiagnostics({
    message: "msg",
    path: ["a"],
    previewValue: noErrorValuePreview,
    modelTrail: ["M"],
  })
  expect(noPreview).toBe("msg - Path: /a - Model trail: M")

  const circular: any = {}
  circular.self = circular
  const circularPreview = buildErrorMessageWithDiagnostics({
    message: "msg",
    path: [],
    previewValue: circular,
  })
  expect(circularPreview).toBe("msg - Path: / - Value: [object Object]")

  const badStringifyValue = {
    toJSON() {
      throw new Error("toJSON failed")
    },
    toString() {
      throw new Error("toString failed")
    },
    valueOf() {
      throw new Error("valueOf failed")
    },
  }
  const fallbackPreview = buildErrorMessageWithDiagnostics({
    message: "msg",
    path: [],
    previewValue: badStringifyValue,
  })
  expect(fallbackPreview).toBe("msg - Path: / - Value: [object Object]")

  const longPreview = buildErrorMessageWithDiagnostics({
    message: "msg",
    path: [],
    previewValue: "x".repeat(210),
  })
  expect(longPreview).toContain("...")
})
