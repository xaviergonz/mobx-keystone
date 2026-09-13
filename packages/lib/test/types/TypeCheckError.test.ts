import { TypeCheckErrorFailure, toTreeNode, typeCheck, types } from "../../src"
import {
  runWithErrorDiagnosticsContext,
  withErrorPathSegment,
} from "../../src/utils/errorDiagnostics"

test("type errors retain repeated ancestor and relative path segments", () => {
  const root = toTreeNode({ value: { value: "wrong" } })
  const error = typeCheck(
    types.object(() => ({ value: types.number })),
    root.value as unknown as { value: number }
  )!
  expect(error.path).toEqual(["value"])
  expect(error.message).toContain("Path: /value/value")
  try {
    error.throw()
  } catch (failure) {
    expect(failure).toBeInstanceOf(TypeCheckErrorFailure)
    expect((failure as TypeCheckErrorFailure).path).toEqual(["value", "value"])
    return
  }
  expect.fail("expected a type-check failure")
})

test("type errors retain repeated numeric path segments", () => {
  const root = toTreeNode([["wrong"]])
  const error = typeCheck(types.array(types.number), root[0] as unknown as number[])!
  expect(error.path).toEqual([0])
  expect(error.message).toContain("Path: /0/0")
  expect(thrownPath(() => error.throw())).toEqual([0, 0])
})

test("missing properties still retain repeated path segments", () => {
  const root = toTreeNode({ value: {} })
  const error = typeCheck(
    types.object(() => ({ value: types.number })),
    root.value as { value: number }
  )!
  expect(thrownPath(() => error.throw())).toEqual(["value", "value"])
})

test("diagnostic context does not duplicate an attached checked value's path", () => {
  const root = toTreeNode({ value: { value: "wrong" } })
  const error = typeCheck(
    types.object(() => ({ value: types.number })),
    root.value as unknown as { value: number }
  )!
  const path = runWithErrorDiagnosticsContext(() =>
    withErrorPathSegment("value", () => thrownPath(() => error.throw()))
  )
  expect(path).toEqual(["value", "value"])
})

test("diagnostic context supplies the path of a detached checked value", () => {
  const node = toTreeNode({ value: "wrong" })
  const error = typeCheck(
    types.object(() => ({ value: types.number })),
    node as unknown as { value: number }
  )!
  const path = runWithErrorDiagnosticsContext(() =>
    withErrorPathSegment("outer", () => thrownPath(() => error.throw()))
  )
  expect(path).toEqual(["outer", "value"])
})

function thrownPath(fn: () => never) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(TypeCheckErrorFailure)
    return (error as TypeCheckErrorFailure).path
  }
}
