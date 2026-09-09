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

test("mixed positional conflicts retain only one copy of an edited model", () => {
  @testModel("mixed-array-child")
  class Child extends Model({ key: idProp, count: tProp(0) }) {}
  @testModel("mixed-array-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(types.or(Child, types.number)), () => [
      new Child({ key: "a" }),
      0,
      new Child({ key: "b" }),
      new Child({ key: "c" }),
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
  list.move(0, 3)
  list.move(0, 2)
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(binding.boundObject.items.filter((item) => item === edited)).toHaveLength(1)
  expect(edited.count).toBe(2)
  const ids = binding.boundObject.items
    .filter((item): item is Child => typeof item !== "number")
    .map((item) => item.key)
  expect(new Set(ids).size).toBe(ids.length)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
