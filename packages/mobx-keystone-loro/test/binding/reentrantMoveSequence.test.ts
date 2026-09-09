import { LoroDoc, type LoroMap, LoroMovableList } from "loro-crdt"
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

test("reentrant primitive moves use native moves and preserve pending values", () => {
  @testModel("reentrant-primitive-move-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(types.number), () => [1, 2]),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const list = root.get("items") as LoroMovableList
  const move = vi.spyOn(LoroMovableList.prototype, "move")
  autoDispose(() => move.mockRestore())
  list.set(0, 9)
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag")
        moveWithinArray(binding.boundObject.items, 0, 2)
    })
  )
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(binding.boundObject.items.slice()).toEqual([2, 9])
  expect(move).toHaveBeenCalledExactlyOnceWith(0, 1)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test.each(["before", "during", "after"])("reentrant moves retain edits %s the move", (when) => {
  @testModel("reentrant-edited-move-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(types.object(() => ({ value: types.number }))), () => [
      { value: 1 },
      { value: 2 },
    ]),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const list = root.get("items") as LoroMovableList
  const first = list.get(0) as LoroMap
  const second = list.get(1) as LoroMap
  const moved = binding.boundObject.items[0]
  second.set("value", 9)
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (
        when === "during" &&
        change.type === DeepChangeType.ArraySplice &&
        change.removedValues.length === 2
      )
        binding.boundObject.items[1].value = 3
      if (change.type !== DeepChangeType.ObjectUpdate || change.key !== "flag") return
      if (when === "before") moved.value = 3
      moveWithinArray(binding.boundObject.items, 0, 2)
      if (when === "after") binding.boundObject.items[1].value = 3
    })
  )
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect((list.get(0) as LoroMap).id).toBe(second.id)
  expect((list.get(1) as LoroMap).id).toBe(first.id)
  expect(binding.boundObject.items.map((item) => item.value)).toEqual([9, 3])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("reentrant moves replay in order around intervening insertions", () => {
  @testModel("reentrant-sequential-move-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(types.number), () => [1, 2, 3]),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const move = vi.spyOn(LoroMovableList.prototype, "move")
  autoDispose(() => move.mockRestore())
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (change.type !== DeepChangeType.ObjectUpdate || change.key !== "flag") return
      moveWithinArray(binding.boundObject.items, 0, 3)
      binding.boundObject.items.push(4)
      moveWithinArray(binding.boundObject.items, 2, 0)
    })
  )
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(binding.boundObject.items.slice()).toEqual([1, 2, 3, 4])
  expect(move.mock.calls).toEqual([
    [0, 2],
    [2, 0],
  ])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
