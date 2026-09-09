import { LoroDoc, type LoroMovableList } from "loro-crdt"
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
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("mixed primitive and model edits preserve pending native model order", () => {
  @testModel("mixed-array-child")
  class Child extends Model({ key: idProp, count: tProp(0) }) {}
  @testModel("mixed-array-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(types.or(Child, types.number)), () => [
      new Child({ key: "a" }),
      0,
      new Child({ key: "b" }),
    ]),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  const list = root.get("items") as LoroMovableList
  autoDispose(binding.dispose)
  const edited = binding.boundObject.items[0] as Child
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") {
        edited.count = 2
        binding.boundObject.items[1] = 1
      }
    })
  )
  list.move(2, 0)
  list.move(1, 2)
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(
    binding.boundObject.items.map((value) =>
      typeof value === "number" ? value : [value.key, value.count]
    )
  ).toEqual([["b", 0], 1, ["a", 2]])
  expect(binding.boundObject.items[2]).toBe(edited)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
