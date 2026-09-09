import { LoroDoc, type LoroMap, LoroMovableList } from "loro-crdt"
import { getSnapshot, Model, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("mixed map deletions avoid reading unrelated arrays", () => {
  @testModel("mixed-map-delete-root")
  class Root extends Model({
    values: tProp(types.record(types.number), () => ({ remove: 1, keep: 2 })),
    untouched: tProp(types.array(types.number), () => Array(5000).fill(0)),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const reads = vi.spyOn(LoroMovableList.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  const values = root.get("values") as LoroMap
  values.delete("remove")
  runUnprotected(() => {
    binding.boundObject.values.keep = 3
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
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const reads = vi.spyOn(LoroMovableList.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  const pair = root.get("pair") as LoroMap
  ;(pair.get("left") as LoroMap).set("value", 1)
  ;(pair.get("right") as LoroMap).set("value", 1)
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(reads).not.toHaveBeenCalled()
  expect(binding.boundObject.pair.left.value).toBe(1)
  expect(binding.boundObject.pair.right.value).toBe(1)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
