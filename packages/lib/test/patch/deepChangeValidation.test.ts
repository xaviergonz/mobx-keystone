import { remove, set } from "mobx"
import {
  applyPatches,
  DeepChangeType,
  getGlobalConfig,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  onDeepChange,
  onGlobalDeepChange,
  onPatches,
  type Patch,
  runUnprotected,
  setGlobalConfig,
  TypeCheckErrorFailure,
  tProp,
  types,
} from "../../src"
import { autoDispose, testModel } from "../utils"

beforeEach(() => {
  const previous = getGlobalConfig().modelAutoTypeChecking
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
  autoDispose(() => setGlobalConfig({ modelAutoTypeChecking: previous }))
})

@testModel("deep-change-validation")
class Root extends Model({
  values: tProp(
    types.refinement(types.array(types.number), (values) => values.length === 1 && values[0] >= 0),
    () => [1]
  ),
  record: tProp(
    types.refinement(
      types.record(types.number),
      (value) => value.extra === undefined && value.count >= 0
    ),
    () => ({ count: 1 })
  ),
  flag: tProp(0),
}) {}

test.each([
  [
    "array update",
    (root: Root) => {
      root.values[0] = -1
    },
  ],
  [
    "array splice",
    (root: Root) => {
      root.values.push(2)
    },
  ],
  [
    "object update",
    (root: Root) => {
      root.record.count = -1
    },
  ],
  [
    "object add",
    (root: Root) => {
      set(root.record, "extra", 2)
    },
  ],
  [
    "object remove",
    (root: Root) => {
      remove(root.record, "count")
    },
  ],
] as const)("rejected %s emits no deep changes", (_, mutate) => {
  const root = new Root({})
  const snapshot = getSnapshot(root)
  const local = vi.fn()
  const global = vi.fn()
  autoDispose(onDeepChange(root, local))
  autoDispose(onGlobalDeepChange(global))
  expect(() => runUnprotected(() => mutate(root))).toThrow(TypeCheckErrorFailure)
  expect(getSnapshot(root)).toBe(snapshot)
  expect(local).not.toHaveBeenCalled()
  expect(global).not.toHaveBeenCalled()
  runUnprotected(() => {
    root.flag = 1
  })
  expect(local).toHaveBeenCalledTimes(1)
  expect(global).toHaveBeenCalledTimes(1)
})

test("deep change listeners can read snapshots and make a subsequent valid edit", () => {
  const root = new Root({})
  const patches: unknown[] = []
  autoDispose(onPatches(root, (p) => patches.push(...p)))
  autoDispose(
    onDeepChange(root.values, () => {
      expect(getSnapshot(root).values).toEqual([2])
      root.flag = 1
    })
  )
  runUnprotected(() => {
    root.values[0] = 2
  })
  expect(getSnapshot(root)).toMatchObject({ values: [2], flag: 1 })
  expect(patches).toHaveLength(2)
  expect(patches).toEqual(
    expect.arrayContaining([
      { op: "replace", path: ["values", 0], value: 2 },
      { op: "replace", path: ["flag"], value: 1 },
    ])
  )
})

test("patches from same-target reentrant deep changes replay in mutation order", () => {
  const root = new Root({})
  const patches: Patch[] = []
  autoDispose(onPatches(root, (p) => patches.push(...p)))
  autoDispose(
    onDeepChange(root, (change) => {
      if (
        change.type === DeepChangeType.ObjectUpdate &&
        change.key === "flag" &&
        change.newValue === 1
      )
        root.flag = 2
    })
  )
  runUnprotected(() => {
    root.flag = 1
  })
  const copy = new Root({})
  applyPatches(copy, patches)
  expect(getSnapshot(copy)).toEqual(getSnapshot(root))
})

test("reentrant patch listeners finish the current mutation before publishing the next", () => {
  const root = new Root({})
  const patches: Patch[] = []
  autoDispose(
    onPatches(root, (p) => {
      if (
        p.some((patch) => patch.op === "replace" && patch.path[0] === "flag" && patch.value === 1)
      )
        root.flag = 2
    })
  )
  autoDispose(onPatches(root, (p) => patches.push(...p)))
  runUnprotected(() => {
    root.flag = 1
  })
  const copy = new Root({})
  applyPatches(copy, patches)
  expect(getSnapshot(copy)).toEqual(getSnapshot(root))
})

test("reentrant array updates preserve forward and inverse patch order", () => {
  const root = new Root({})
  const before = getSnapshot(root)
  const patches: Patch[] = []
  const inverse: Patch[][] = []
  autoDispose(
    onPatches(root, (p, inv) => {
      patches.push(...p)
      inverse.unshift(inv)
    })
  )
  autoDispose(
    onDeepChange(root.values, (change) => {
      if (change.type === DeepChangeType.ArrayUpdate && change.newValue === 2) root.values[0] = 3
    })
  )
  runUnprotected(() => {
    root.values[0] = 2
  })
  const copy = new Root({})
  applyPatches(copy, patches)
  expect(getSnapshot(copy)).toEqual(getSnapshot(root))
  for (const batch of inverse) applyPatches(copy, batch)
  expect(getSnapshot(copy)).toEqual(before)
})

test("patch paths retain their mutation-time parent when a listener removes a child", () => {
  @testModel("reentrant-parent")
  class Parent extends Model({ child: tProp(types.maybe(Root), () => new Root({})) }) {}
  const parent = new Parent({})
  const patches: Patch[] = []
  autoDispose(onPatches(parent, (p) => patches.push(...p)))
  autoDispose(
    onDeepChange(parent.child!, () => {
      parent.child = undefined
    })
  )
  runUnprotected(() => {
    parent.child!.flag = 1
  })
  expect(patches.map((p) => p.path)).toEqual([["child", "flag"], ["child"]])
  const copy = new Parent({})
  applyPatches(copy, patches)
  expect(getSnapshot(copy)).toEqual(getSnapshot(parent))
})

test("reentrant metadata reaches ancestor listeners for both overlapping changes", () => {
  const root = new Root({})
  const changes: { value: unknown; reentrant: boolean | undefined }[] = []
  autoDispose(
    onDeepChange(root.values, (change) => {
      if (change.type === DeepChangeType.ArrayUpdate && change.newValue === 2) root.values[0] = 3
    })
  )
  autoDispose(
    onDeepChange(root, (change) => {
      if (change.type === DeepChangeType.ArrayUpdate)
        changes.push({ value: change.newValue, reentrant: change.isReentrant })
    })
  )
  runUnprotected(() => {
    root.values[0] = 2
  })
  expect(changes).toEqual([
    { value: 3, reentrant: true },
    { value: 2, reentrant: true },
  ])
})
