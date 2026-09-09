import { LoroDoc, type LoroMap, type LoroMovableList, type LoroText } from "loro-crdt"
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
import { bindLoroToMobxKeystone, LoroTextModel, moveWithinArray } from "../../src"
import { convertLoroDataToJson } from "../../src/binding/convertLoroDataToJson"
import { autoDispose, testModel } from "../utils"

test.each([false, true])(
  "reentrant moves preserve native model containers (pending edit: %s)",
  (pending) => {
    @testModel("reentrant-move-child")
    class Child extends Model({ key: idProp, value: tProp(0) }) {}
    @testModel("reentrant-move-root")
    class Root extends Model({
      flag: tProp(0),
      items: tProp(types.array(Child), () => [new Child({ key: "a" }), new Child({ key: "b" })]),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(binding.dispose)
    const list = root.get("items") as LoroMovableList
    const first = list.get(0) as LoroMap
    const second = list.get(1) as LoroMap
    const models = binding.boundObject.items.slice()
    if (pending) second.set("value", 9)
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (
          change.type === DeepChangeType.ObjectUpdate &&
          change.key === "flag" &&
          change.newValue === 1
        )
          moveWithinArray(binding.boundObject.items, 0, 2)
      })
    )
    runUnprotected(() => {
      binding.boundObject.flag = 1
    })
    expect(binding.boundObject.items[0]).toBe(models[1])
    expect(binding.boundObject.items[1]).toBe(models[0])
    expect((list.get(0) as LoroMap).id).toBe(second.id)
    expect((list.get(1) as LoroMap).id).toBe(first.id)
    expect(binding.boundObject.items[0].value).toBe(pending ? 9 : 0)
    expect(convertLoroDataToJson(root)).toEqual(getSnapshot(binding.boundObject))
  }
)

test.each([
  ["insert before moved models", ["c", "b", "a"]],
  ["insert between moved models", ["b", "c", "a"]],
  ["remove before retained model", ["b"]],
  ["insert without moving retained models", ["c", "a", "b"]],
] as const)("reentrant list edits preserve model and text containers: %s", (_, order) => {
  @testModel("reentrant-text-move-child")
  class Child extends Model({ key: idProp, text: tProp(LoroTextModel) }) {}
  @testModel("reentrant-text-move-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(Child), () => [
      new Child({ key: "a", text: LoroTextModel.withText("a") }),
      new Child({ key: "b", text: LoroTextModel.withText("b") }),
    ]),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const list = root.get("items") as LoroMovableList
  const original = new Map(
    binding.boundObject.items.map((model, index) => {
      const native = list.get(index) as LoroMap
      return [model.key, { model, native, text: native.get("text") as LoroText }] as const
    })
  )
  original.get("b")!.text.insert(1, "!")
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (change.type !== DeepChangeType.ObjectUpdate || change.key !== "flag") return
      binding.boundObject.items.splice(0)
      for (const key of order)
        binding.boundObject.items.push(
          original.get(key)?.model ?? new Child({ key, text: LoroTextModel.withText(key) })
        )
    })
  )
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(binding.boundObject.items.map((item) => item.key)).toEqual(order)
  order.forEach((key, index) => {
    const old = original.get(key)
    if (!old) return
    const native = list.get(index) as LoroMap
    expect(binding.boundObject.items[index]).toBe(old.model)
    expect(native.id).toBe(old.native.id)
    expect((native.get("text") as LoroText).id).toBe(old.text.id)
    expect(old.model.text.text).toBe(key === "b" ? "b!" : "a")
  })
  expect(convertLoroDataToJson(root)).toEqual(getSnapshot(binding.boundObject))
})

test.each([1, 2])(
  "reentrant moves preserve plain-object containers (second value: %s)",
  (secondValue) => {
    @testModel("reentrant-plain-move-root")
    class Root extends Model({
      flag: tProp(0),
      items: tProp(types.array(types.object(() => ({ value: types.number }))), () => [
        { value: 1 },
        { value: secondValue },
      ]),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(binding.dispose)
    const list = root.get("items") as LoroMovableList
    const first = list.get(0) as LoroMap
    const second = list.get(1) as LoroMap
    second.set("value", 9)
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag")
          moveWithinArray(binding.boundObject.items, 0, 2)
      })
    )
    runUnprotected(() => {
      binding.boundObject.flag = 1
    })
    expect((list.get(0) as LoroMap).id).toBe(second.id)
    expect((list.get(1) as LoroMap).id).toBe(first.id)
    expect(binding.boundObject.items.map((item) => item.value)).toEqual([9, 1])
    expect(convertLoroDataToJson(root)).toEqual(getSnapshot(binding.boundObject))
  }
)
