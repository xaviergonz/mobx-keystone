import { Model, onDeepChange, onGlobalDeepChange, prop, runUnprotected } from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("listener-errors-root")
class Root extends Model({ child: prop(() => ({ value: 0 })) }) {}

test("listener errors do not prevent later global, subtree, and ancestor delivery", () => {
  const root = new Root({})
  const seen: string[] = []
  const first = new Error("first")
  autoDispose(
    onGlobalDeepChange(() => {
      seen.push("global1")
      throw first
    })
  )
  autoDispose(
    onGlobalDeepChange(() => {
      seen.push("global2")
      throw new Error("second")
    })
  )
  autoDispose(
    onDeepChange(root.child, () => {
      seen.push("child1")
      throw new Error("third")
    })
  )
  autoDispose(
    onDeepChange(root.child, () => {
      seen.push("child2")
    })
  )
  autoDispose(
    onDeepChange(root, () => {
      seen.push("root")
    })
  )
  expect(() =>
    runUnprotected(() => {
      root.child.value = 1
    })
  ).toThrow(first)
  expect(seen).toEqual(["global1", "global2", "child1", "child2", "root"])
  expect(root.child.value).toBe(1)
})

test("nested listener errors finish both emissions and leave later edits usable", () => {
  const root = new Root({})
  const seen: number[] = []
  const error = new Error("nested")
  autoDispose(
    onDeepChange(root.child, () => {
      if (root.child.value === 1) root.child.value = 2
      else if (root.child.value === 2) throw error
    })
  )
  autoDispose(
    onDeepChange(root, () => {
      seen.push(root.child.value)
    })
  )
  expect(() =>
    runUnprotected(() => {
      root.child.value = 1
    })
  ).toThrow(error)
  expect(seen).toEqual([2, 2])
  runUnprotected(() => {
    root.child.value = 3
  })
  expect(seen).toEqual([2, 2, 3])
})
