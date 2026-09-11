import {
  MobxKeystoneAggregateError,
  Model,
  onDeepChange,
  onGlobalDeepChange,
  onPatches,
  patchRecorder,
  prop,
  runUnprotected,
} from "../../src"
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
  let caught: unknown
  try {
    runUnprotected(() => {
      root.child.value = 1
    })
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(MobxKeystoneAggregateError)
  expect((caught as MobxKeystoneAggregateError).errors[0]).toBe(first)
  expect((caught as MobxKeystoneAggregateError).errors.map((e) => (e as Error).message)).toEqual([
    "first",
    "second",
    "third",
  ])
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

test("a throwing patch recorder still lets the deep change and the public patches through", () => {
  const root = new Root({})
  const seen: string[] = []
  const recorderError = new Error("recorder")
  const deepChangeError = new Error("deepChange")
  const patchesError = new Error("patches")

  const recorder = patchRecorder(root, {
    filter: () => {
      seen.push("recorder")
      throw recorderError
    },
  })
  autoDispose(() => {
    recorder.dispose()
  })
  autoDispose(
    onDeepChange(root, () => {
      seen.push("deepChange")
      throw deepChangeError
    })
  )
  autoDispose(
    onPatches(root, () => {
      seen.push("patches")
      throw patchesError
    })
  )

  let caught: unknown
  try {
    runUnprotected(() => {
      root.child.value = 1
    })
  } catch (error) {
    caught = error
  }

  // the recorder runs first, then the deep change, and the public patches are delivered last
  expect(seen).toEqual(["recorder", "deepChange", "patches"])
  expect(caught).toBeInstanceOf(MobxKeystoneAggregateError)
  expect((caught as MobxKeystoneAggregateError).errors).toEqual([
    recorderError,
    deepChangeError,
    patchesError,
  ])
  expect(root.child.value).toBe(1)
})
