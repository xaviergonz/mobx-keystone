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
import { bindYjsToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("reentrant model reordering retains pending native fields", () => {
  @testModel("reentrant-move-child")
  class Child extends Model({ key: idProp, value: tProp(0) }) {}
  @testModel("reentrant-move-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(Child), () => [new Child({ key: "a" }), new Child({ key: "b" })]),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const list = root.get("items") as Y.Array<Y.Map<unknown>>
  const models = binding.boundObject.items.slice()
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (
        change.type === DeepChangeType.ObjectUpdate &&
        change.key === "flag" &&
        change.newValue === 1
      )
        binding.boundObject.items.reverse()
    })
  )
  doc.transact(() => {
    list.get(1).set("value", 9)
    runUnprotected(() => {
      binding.boundObject.flag = 1
    })
  })
  expect(binding.boundObject.items[0]).toBe(models[1])
  expect(binding.boundObject.items[1]).toBe(models[0])
  expect(binding.boundObject.items[0].value).toBe(9)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
