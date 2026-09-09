import { LoroDoc, type LoroMap, type LoroMovableList } from "loro-crdt"
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
import { bindLoroToMobxKeystone, convertJsonToLoroData } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([
  ["move", false],
  ["insert", false],
  ["delete", false],
  ["move", true],
  ["insert", true],
  ["delete", true],
] as const)(
  "model field edits follow pending native %s operations (reentrant: %s)",
  (kind, reentrant) => {
    @testModel("pending-order-child")
    class Child extends Model({ key: idProp, count: tProp(0) }) {}
    @testModel("pending-order-root")
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
    const nativeOriginal = list.toArray()
    const original = binding.boundObject.items.slice()
    const edited = original[kind === "delete" ? 1 : 0]
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") edited.count = 2
      })
    )
    if (kind === "move") {
      list.move(0, 1)
    } else if (kind === "insert") {
      list.insertContainer(
        0,
        convertJsonToLoroData(getSnapshot(new Child({ key: "c" }))) as LoroMap
      )
    } else list.delete(0, 1)
    runUnprotected(() => {
      if (reentrant) binding.boundObject.flag = 1
      else edited.count = 2
    })
    const expected =
      kind === "move"
        ? [
            ["b", 0],
            ["a", 2],
          ]
        : kind === "insert"
          ? [
              ["c", 0],
              ["a", 2],
              ["b", 0],
            ]
          : [["b", 2]]
    expect(binding.boundObject.items.map((item) => [item.key, item.count])).toEqual(expected)
    expect(binding.boundObject.items.find((item) => item.key === edited.key)).toBe(edited)
    const expectedContainers =
      kind === "move"
        ? [nativeOriginal[1], nativeOriginal[0]]
        : kind === "delete"
          ? [nativeOriginal[1]]
          : [list.get(0), ...nativeOriginal]
    expect(list.toArray().map((item) => (item as LoroMap).id)).toEqual(
      expectedContainers.map((item) => (item as LoroMap).id)
    )
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)
