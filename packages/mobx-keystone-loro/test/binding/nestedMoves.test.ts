import { LoroDoc, type LoroMap, type LoroMovableList } from "loro-crdt"
import {
  DeepChangeType,
  getSnapshot,
  Model,
  onDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone, moveWithinArray } from "../../src"
import { autoDispose, testModel } from "../utils"

test("moves inside move listeners preserve native operation order", () => {
  @testModel("nested-move-root")
  class Root extends Model({
    items: tProp(types.array(types.object(() => ({ value: types.number }))), () => [
      { value: 1 },
      { value: 2 },
      { value: 3 },
    ]),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const list = root.get("items") as LoroMovableList
  const original = list.toArray() as LoroMap[]
  original[0].set("value", 9)
  let nested = false
  autoDispose(
    onDeepChange(binding.boundObject.items, (change) => {
      if (change.type === DeepChangeType.ArraySplice && !nested) {
        nested = true
        moveWithinArray(binding.boundObject.items, 1, 0)
      }
    })
  )
  runUnprotected(() => moveWithinArray(binding.boundObject.items, 0, 3))
  expect(list.toArray().map((item) => (item as LoroMap).id)).toEqual([
    original[2].id,
    original[1].id,
    original[0].id,
  ])
  expect(binding.boundObject.items.map((item) => item.value)).toEqual([3, 2, 9])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("listener insertions are reconciled before the following explicit move", () => {
  @testModel("move-listener-insertion-root")
  class Root extends Model({ items: tProp(types.array(types.number), () => [1, 2, 3]) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  let inserted = false
  autoDispose(
    onDeepChange(binding.boundObject.items, (change) => {
      if (change.type === DeepChangeType.ArraySplice && !inserted) {
        inserted = true
        binding.boundObject.items.unshift(4)
      }
    })
  )
  runUnprotected(() => {
    moveWithinArray(binding.boundObject.items, 0, 3)
    moveWithinArray(binding.boundObject.items, 3, 0)
  })
  expect(binding.boundObject.items.slice()).toEqual([1, 4, 2, 3])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
