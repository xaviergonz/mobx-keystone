import { autorun } from "mobx"
import {
  DeepChangeType,
  getSnapshot,
  idProp,
  Model,
  onDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { applyJsonArrayToYArray, applyJsonObjectToYMap, bindYjsToMobxKeystone } from "../../src"
import {
  getYjsCollectionAtom,
  reportYjsCollectionObserved,
} from "../../src/utils/yjsCollectionAtoms"
import { autoDispose, testModel } from "../utils"

test.each([0, 1])("shrinking an array reads only its %i retained items", (length) => {
  const array = new Y.Doc().getArray("root")
  array.push(Array.from({ length: 1000 }, (_, index) => index))
  const read = vi.spyOn(array, "toArray")
  try {
    const source = Array.from({ length }, () => -1)
    applyJsonArrayToYArray(array, source, { mode: "merge" })
    expect(array.toJSON()).toEqual(source)
    expect(read).toHaveBeenCalledTimes(length === 0 ? 0 : 1)
    if (length > 0) expect(read.mock.results[0].value).toHaveLength(length)
  } finally {
    read.mockRestore()
  }
})

test("map merges remove inherited and undefined keys while preserving own special keys", () => {
  const map = new Y.Doc().getMap("root")
  map.set("inherited", 1)
  map.set("omitted", 2)
  map.set("kept", 3)
  const source = Object.assign(Object.create({ inherited: 1 }), { omitted: undefined, kept: 4 })
  Object.defineProperty(source, "__proto__", { value: 5, enumerable: true })
  applyJsonObjectToYMap(map, source, { mode: "merge" })
  expect(Array.from(map.entries())).toEqual([
    ["kept", 4],
    ["__proto__", 5],
  ])
})

test("collection reads only allocate atoms while a derivation is tracking", () => {
  const map = new Y.Doc().getMap<unknown>("root")

  // Writing to Yjs happens outside any derivation, where an atom would be dead weight.
  reportYjsCollectionObserved(map, "value")
  expect(getYjsCollectionAtom(map, "value")).toBeUndefined()

  let tracked: unknown
  const stop = autorun(() => {
    reportYjsCollectionObserved(map, "value")
    tracked = getYjsCollectionAtom(map, "value")
  })
  expect(tracked).toBeDefined()

  // The atom stays cached while observed, then is dropped once nothing tracks it.
  reportYjsCollectionObserved(map, "value")
  expect(getYjsCollectionAtom(map, "value")).toBe(tracked)
  stop()
  expect(getYjsCollectionAtom(map, "value")).toBeUndefined()
})

test("pending native fields with unchanged model identity avoid unrelated array reads", () => {
  @testModel("pending-read-child")
  class Child extends Model({ key: idProp, count: tProp(0) }) {}
  @testModel("pending-read-root")
  class Root extends Model({
    child: tProp(Child, () => new Child({ key: "child" })),
    other: tProp(0),
    untouched: tProp(types.array(types.number), () => Array(5000).fill(0)),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const reads = vi.spyOn(Y.Array.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  doc.transact(() => {
    root.set("other", 9)
    runUnprotected(() => {
      binding.boundObject.child.count = 2
    })
  })
  expect(reads).not.toHaveBeenCalled()
  expect(binding.boundObject.child.count).toBe(2)
  expect(binding.boundObject.other).toBe(9)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("mixed map deletions avoid reading unrelated arrays", () => {
  @testModel("mixed-map-delete-root")
  class Root extends Model({
    values: tProp(types.record(types.number), () => ({ remove: 1, keep: 2 })),
    untouched: tProp(types.array(types.number), () => Array(5000).fill(0)),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const reads = vi.spyOn(Y.Array.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  const values = root.get("values") as Y.Map<unknown>
  doc.transact(() => {
    values.delete("remove")
    runUnprotected(() => {
      binding.boundObject.values.keep = 3
    })
  })
  expect(reads).not.toHaveBeenCalled()
  expect(getSnapshot(binding.boundObject.values)).toEqual({ keep: 3 })
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("mixed map commits validate related native changes together without unrelated reads", () => {
  const Pair = types.refinement(
    types.object(() => ({
      left: types.record(types.number),
      right: types.record(types.number),
    })),
    (pair) => pair.left.value === pair.right.value
  )
  @testModel("mixed-refined-map-root")
  class Root extends Model({
    flag: tProp(0),
    pair: tProp(Pair, () => ({ left: { value: 0 }, right: { value: 0 } })),
    untouched: tProp(types.array(types.number), () => Array(5000).fill(0)),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const reads = vi.spyOn(Y.Array.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  const pair = root.get("pair") as Y.Map<unknown>
  doc.transact(() => {
    ;(pair.get("left") as Y.Map<unknown>).set("value", 1)
    ;(pair.get("right") as Y.Map<unknown>).set("value", 1)
    runUnprotected(() => {
      binding.boundObject.flag = 1
    })
  })
  expect(reads).not.toHaveBeenCalled()
  expect(binding.boundObject.pair.left.value).toBe(1)
  expect(binding.boundObject.pair.right.value).toBe(1)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("reentrant primitive arrays avoid container-position scans", () => {
  @testModel("primitive-position-root")
  class Root extends Model({
    values: tProp(types.array(types.number), () => Array(1000).fill(0)),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  autoDispose(
    onDeepChange(binding.boundObject.values, (change) => {
      if (change.type === DeepChangeType.ArrayUpdate && change.newValue === 1)
        binding.boundObject.values[0] = 2
    })
  )
  const reads = vi.spyOn(Y.Array.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  runUnprotected(() => {
    binding.boundObject.values[0] = 1
  })
  expect(reads.mock.calls.length).toBeLessThanOrEqual(1)
  expect(binding.boundObject.values[0]).toBe(2)
  expect((root.get("values") as Y.Array<number>).get(0)).toBe(2)
})
