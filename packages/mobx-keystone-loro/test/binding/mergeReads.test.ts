import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { DeepChangeType, Model, onDeepChange, runUnprotected, tProp, types } from "mobx-keystone"
import {
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  bindLoroToMobxKeystone,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test("list merge reads existing contents in bulk and observes later mutations", () => {
  const list = new LoroDoc().getMovableList("items")
  const source = Array.from({ length: 1000 }, (_, index) => index)
  applyJsonArrayToLoroMovableList(list, source)
  const get = vi.spyOn(list, "get")
  const toArray = vi.spyOn(list, "toArray")
  try {
    applyJsonArrayToLoroMovableList(list, source, { mode: "merge" })
    list.set(500, -1)
    source[20] = 2000
    applyJsonArrayToLoroMovableList(list, source, { mode: "merge" })
    expect(list.toJSON()).toEqual(source)
    expect(get.mock.calls.length).toBe(0)
    expect(toArray).toHaveBeenCalledTimes(2)
  } finally {
    get.mockRestore()
    toArray.mockRestore()
  }
})

test("map merge removes keys present only on the source prototype", () => {
  const map = new LoroDoc().getMap("root")
  map.set("inherited", 1)
  map.set("omitted", 2)
  map.set("kept", 3)
  const source = Object.assign(Object.create({ inherited: 1 }), { omitted: undefined, kept: 4 })
  applyJsonObjectToLoroMap(map, source, { mode: "merge" })
  expect(map.toJSON()).toEqual({ kept: 4 })
})

test.each([0, 1])("shrinking a list reads only its %i retained items", (length) => {
  const list = new LoroDoc().getMovableList("items")
  applyJsonArrayToLoroMovableList(
    list,
    Array.from({ length: 1000 }, (_, index) => index)
  )
  const toArray = vi.spyOn(list, "toArray")
  const source = Array.from({ length }, () => -1)
  try {
    applyJsonArrayToLoroMovableList(list, source, { mode: "merge" })
    expect(list.toJSON()).toEqual(source)
    expect(toArray.mock.calls.length).toBe(length === 0 ? 0 : 1)
    if (length > 0) expect(toArray.mock.results[0].value).toHaveLength(length)
  } finally {
    toArray.mockRestore()
  }
})

test.each(["map", "list"])("merging NaN into a %s skips redundant writes", (kind) => {
  const doc = new LoroDoc()
  if (kind === "map") {
    const map = doc.getMap("root")
    map.set("value", Number.NaN)
    const write = vi.spyOn(map, "set")
    applyJsonObjectToLoroMap(map, { value: Number.NaN }, { mode: "merge" })
    expect(write).not.toHaveBeenCalled()
  } else {
    const list = doc.getMovableList("root")
    list.push(Number.NaN)
    const write = vi.spyOn(list, "set")
    applyJsonArrayToLoroMovableList(list, [Number.NaN], { mode: "merge" })
    expect(write).not.toHaveBeenCalled()
  }
})

test("detached maps and lists support merging their readable contents", () => {
  const map = new LoroMap()
  applyJsonObjectToLoroMap(map, { removed: 1, nested: { value: 2 } })
  applyJsonObjectToLoroMap(map, { nested: { value: 3 } }, { mode: "merge" })
  expect(map.toJSON()).toEqual({ nested: { value: 3 } })
  const list = new LoroMovableList()
  applyJsonArrayToLoroMovableList(list, [1, { value: 2 }, 3])
  applyJsonArrayToLoroMovableList(list, [4, { value: 5 }], { mode: "merge" })
  expect(list.toJSON()).toEqual([4, { value: 5 }])
})

test("reentrant reconciliation skips subtrees the merge left untouched", () => {
  @testModel("reentrant-untouched-root")
  class Root extends Model({
    flag: tProp(0),
    untouched: tProp(types.array(types.number), () => Array(5000).fill(0)),
    nested: tProp(
      types.object(() => ({ deep: types.array(types.number) })),
      () => ({ deep: Array(5000).fill(0) })
    ),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  // A reentrant change forces the whole-snapshot reconciliation fallback.
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (change.type === DeepChangeType.ObjectUpdate && change.newValue === 1) {
        binding.boundObject.flag = 2
      }
    })
  )
  const reads = vi.spyOn(LoroMovableList.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  // Reading the native snapshot visits each list once. Neither list changed, so
  // the merged snapshot shares both with it by reference and the write-back must
  // not read either one a second time.
  expect(reads).toHaveBeenCalledTimes(2)
  expect(binding.boundObject.flag).toBe(2)
  expect(root.get("flag")).toBe(2)
})
