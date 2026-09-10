import type { IObservableArray } from "mobx"
import {
  applyPatches,
  fromSnapshot,
  getSnapshot,
  idProp,
  internalPatchRecorder,
  Model,
  ModelAutoTypeCheckingMode,
  onPatches,
  onSnapshot,
  type Patch,
  prop,
  setGlobalConfig,
  tProp,
  types,
} from "../../src"
import { testModel } from "../utils"

@testModel("PatchBatchRange")
class Range extends Model({
  values: tProp(
    types.refinement(types.array(types.number), (values) => values[0] <= values[1]),
    () => [0, 10]
  ),
  extra: prop<number | undefined>(),
}) {}

beforeEach(() => {
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
})

const validPatches: Patch[] = [
  { op: "replace", path: ["values", 0], value: 20 },
  { op: "replace", path: ["values", 1], value: 30 },
]

test.each([false, true])("validates a completed patch batch (nested=%s)", (nested) => {
  const range = new Range({})
  applyPatches(range, nested ? validPatches.map((p) => [p]) : validPatches)
  expect(range.values.slice()).toEqual([20, 30])
})

test("reverse replay validates the completed batch", () => {
  const range = new Range({})
  applyPatches(range, [...validPatches].reverse(), true)
  expect(range.values.slice()).toEqual([20, 30])
})

test("checks typed descendants beneath an untyped root and rolls back the whole batch", () => {
  const range = new Range({})
  const root = fromSnapshot<{ range: Range; count: number }>({
    range: getSnapshot(range),
    count: 0,
  })
  const before = getSnapshot(root)
  expect(() =>
    applyPatches(root, [
      { op: "replace", path: ["count"], value: 1 },
      { op: "replace", path: ["range", "values", 0], value: 20 },
    ])
  ).toThrow("TypeCheckError")
  expect(getSnapshot(root)).toEqual(before)
})

test("rollback preserves absent keys and emits compensating patches", () => {
  const range = new Range({})
  const before = getSnapshot(range)
  const snapshots: unknown[] = []
  const stopSnapshots = onSnapshot(range, (snapshot) => snapshots.push(snapshot))
  const patches: Patch[][] = []
  const dispose = onPatches(range, (p) => patches.push(p))
  try {
    expect(() =>
      applyPatches(range, [
        { op: "add", path: ["newKey"], value: undefined },
        { op: "replace", path: ["values", 0], value: 20 },
      ])
    ).toThrow("TypeCheckError")
    expect(Object.hasOwn(getSnapshot(range), "newKey")).toBe(false)
    expect(range.values.slice()).toEqual([0, 10])
    expect(snapshots.length).toBeLessThanOrEqual(1)
    for (const snapshot of snapshots) expect(snapshot).toEqual(before)
    expect(patches.flat()).toContainEqual({ op: "remove", path: ["newKey"] })
  } finally {
    dispose()
    stopSnapshots()
  }
})

test("nested patch calls from a listener join the outer validation batch", () => {
  const range = new Range({})
  let handled = false
  const dispose = onPatches(range, () => {
    if (!handled) {
      handled = true
      applyPatches(range, [{ op: "replace", path: ["values", 1], value: 30 }])
    }
  })
  try {
    applyPatches(range, [validPatches[0]])
    expect(range.values.slice()).toEqual([20, 30])
  } finally {
    dispose()
  }
})

test("type checking stays enabled after a failed batch", () => {
  const range = new Range({})
  expect(() => applyPatches(range, [validPatches[0]])).toThrow("TypeCheckError")
  expect(() => applyPatches(range, [validPatches[0]])).toThrow("TypeCheckError")
  applyPatches(range, validPatches)
  expect(range.values.slice()).toEqual([20, 30])
})

test("new typed models can be completed by later patches in the batch", () => {
  const root = fromSnapshot<{ child?: Range }>({})
  const snapshot = { ...getSnapshot(new Range({})), values: [20, 10] }
  applyPatches(root, [
    { op: "add", path: ["child"], value: snapshot },
    { op: "replace", path: ["child", "values", 1], value: 30 },
  ])
  expect(root.child!.values.slice()).toEqual([20, 30])
})

test("new typed descendants are validated even without later mutations", () => {
  const root = fromSnapshot<{ child?: Range }>({})
  const snapshot = { ...getSnapshot(new Range({})), values: [20, 10] }
  expect(() => applyPatches(root, [{ op: "add", path: ["child"], value: snapshot }])).toThrow(
    "TypeCheckError"
  )
  expect(getSnapshot(root)).toEqual({})
})

test("validates typed ancestors outside the patch root", () => {
  const range = new Range({})
  applyPatches(range.values, [
    { op: "replace", path: [0], value: 20 },
    { op: "replace", path: [1], value: 30 },
  ])
  expect(range.values.slice()).toEqual([20, 30])
  expect(() => applyPatches(range.values, [{ op: "replace", path: [0], value: 40 }])).toThrow(
    "TypeCheckError"
  )
  expect(range.values.slice()).toEqual([20, 30])
})

test("listener mutations to another tree are validated and rolled back", () => {
  const range = new Range({})
  const other = new Range({})
  let handled = false
  const dispose = onPatches(range, () => {
    if (!handled) {
      handled = true
      applyPatches(other, [validPatches[0]])
    }
  })
  try {
    expect(() => applyPatches(range, validPatches)).toThrow("TypeCheckError")
    expect(range.values.slice()).toEqual([0, 10])
    expect(other.values.slice()).toEqual([0, 10])
  } finally {
    dispose()
  }
})

test("rollback follows mutation order when a synchronous patch recorder reenters", () => {
  const range = new Range({})
  let handled = false
  const recorder = internalPatchRecorder(undefined, {
    onPatches() {
      if (!handled) {
        handled = true
        applyPatches(range, [{ op: "replace", path: ["extra"], value: 2 }])
      }
    },
  })
  try {
    expect(() =>
      applyPatches(range, [{ op: "replace", path: ["extra"], value: 1 }, validPatches[0]])
    ).toThrow("TypeCheckError")
    expect(range.extra).toBeUndefined()
    expect(range.values.slice()).toEqual([0, 10])
  } finally {
    recorder.dispose()
  }
})

test("rollback reuses removed identified models", () => {
  @testModel("PatchBatchIdentified")
  class Identified extends Model({ id: idProp, value: prop(0) }) {}
  const item = new Identified({})
  const root = fromSnapshot<{ item?: Identified; range: Range }>({
    item: getSnapshot(item),
    range: getSnapshot(new Range({})),
  })
  const original = root.item
  expect(() =>
    applyPatches(root, [
      { op: "remove", path: ["item"] },
      { op: "replace", path: ["range", "values", 0], value: 20 },
    ])
  ).toThrow("TypeCheckError")
  expect(root.item).toBe(original)
})

test("rollback preserves model identity in a listener's patch target", () => {
  @testModel("NestedPatchBatchIdentified")
  class Identified extends Model({ id: idProp }) {}
  const range = new Range({})
  const other = fromSnapshot<{ item?: Identified }>({ item: getSnapshot(new Identified({})) })
  const original = other.item
  let handled = false
  const dispose = onPatches(range, () => {
    if (!handled) {
      handled = true
      applyPatches(other, [{ op: "remove", path: ["item"] }])
    }
  })
  try {
    expect(() => applyPatches(range, [validPatches[0]])).toThrow("TypeCheckError")
    expect(other.item).toBe(original)
  } finally {
    dispose()
  }
})

test("rollback restores edits inside a subsequently removed model without an id", () => {
  const root = fromSnapshot<{ child?: Range; checked: Range }>({
    child: getSnapshot(new Range({})),
    checked: getSnapshot(new Range({})),
  })
  const before = getSnapshot(root)
  expect(() =>
    applyPatches(root, [
      { op: "replace", path: ["child", "extra"], value: 1 },
      { op: "remove", path: ["child"] },
      { op: "replace", path: ["checked", "values", 0], value: 20 },
    ])
  ).toThrow("TypeCheckError")
  expect(getSnapshot(root)).toEqual(before)
})

test("rollback restores a removed model after an intermediate refinement violation", () => {
  const root = fromSnapshot<{ child?: Range }>({ child: getSnapshot(new Range({})) })
  const before = getSnapshot(root)
  expect(() =>
    applyPatches(root, [
      { op: "replace", path: ["child", "values", 0], value: 20 },
      { op: "remove", path: ["child"] },
    ])
  ).toThrow("TypeCheckError")
  expect(getSnapshot(root)).toEqual(before)
})

test("rollback preserves literal missing defaults and identity in removed models", () => {
  @testModel("LiteralPatchBatchChild")
  class Child extends Model({ x: prop(0), y: prop(0) }) {}
  const root = fromSnapshot<{ child?: Child; checked: Range }>({
    child: getSnapshot(new Child({})),
    checked: getSnapshot(new Range({})),
  })
  applyPatches(root, [{ op: "remove", path: ["child", "x"] }])
  const original = root.child
  const before = getSnapshot(root)
  expect(() =>
    applyPatches(root, [
      { op: "replace", path: ["child", "y"], value: 1 },
      { op: "remove", path: ["child"] },
      { op: "replace", path: ["checked", "values", 0], value: 20 },
    ])
  ).toThrow("TypeCheckError")
  expect(getSnapshot(root)).toEqual(before)
  expect(root.child).toBe(original)
})

test("rollback continues when a listener throws during compensating changes", () => {
  const range = new Range({})
  const before = getSnapshot(range)
  let constructorRejected = false
  const dispose = onPatches(range, (patches) => {
    if (
      patches.some(
        (patch) => patch.op === "replace" && patch.path[0] === "values" && patch.value === 0
      )
    ) {
      try {
        new Range({ values: [20, 10] })
      } catch {
        constructorRejected = true
      }
      throw new Error("rollback listener failed")
    }
  })
  try {
    expect(() =>
      applyPatches(range, [{ op: "replace", path: ["extra"], value: 1 }, validPatches[0]])
    ).toThrow("TypeCheckError")
    expect(getSnapshot(range)).toEqual(before)
    expect(constructorRejected).toBe(true)
  } finally {
    dispose()
  }
})

test("errors thrown by the batch body do not roll back applied patches", () => {
  const range = new Range({})
  const dispose = onPatches(range, () => {
    throw new Error("listener failed")
  })
  try {
    expect(() => applyPatches(range, validPatches)).toThrow("listener failed")
  } finally {
    dispose()
  }
  // Same partial application automatic type checking being off would produce.
  expect(range.values.slice()).toEqual([20, 10])
})

test("an invalid patch does not roll back the patches before it", () => {
  const root = fromSnapshot<{ a: number; b: number }>({ a: 1, b: 2 })
  expect(() =>
    applyPatches(root, [
      { op: "replace", path: ["a"], value: 5 },
      { op: "replace", path: ["missing", "deep"], value: 5 },
    ])
  ).toThrow()
  expect(getSnapshot(root)).toEqual({ a: 5, b: 2 })
})

test("no-op listener splices do not validate an unrelated model", () => {
  const range = new Range({})
  const other = new Range({})
  const check = vi.spyOn(other, "typeCheck")
  let handled = false
  const dispose = onPatches(range, () => {
    if (!handled) {
      handled = true
      ;(other.values as IObservableArray<number>).spliceWithArray(0, 2, [0, 10])
    }
  })
  try {
    applyPatches(range, validPatches)
    expect(check).not.toHaveBeenCalled()
  } finally {
    dispose()
    check.mockRestore()
  }
})
