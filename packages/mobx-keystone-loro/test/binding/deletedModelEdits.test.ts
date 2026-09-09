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
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([
  ["first", false],
  ["last", false],
  ["first", true],
  ["last", true],
] as const)(
  "edits restore a deleted %s model without removing survivors (reentrant: %s)",
  (kind, reentrant) => {
    @testModel("deleted-field-child")
    class Child extends Model({ key: idProp, count: tProp(0) }) {}
    @testModel("deleted-field-root")
    class Root extends Model({
      flag: tProp(0),
      items: tProp(types.array(Child), () => ["a", "b", "c"].map((key) => new Child({ key }))),
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
    const original = binding.boundObject.items.slice()
    const nativeOriginal = list.toArray() as LoroMap[]
    const edited = original[kind === "first" ? 0 : 2]
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") edited.count = 2
      })
    )
    if (kind === "first") list.delete(0, 1)
    else list.delete(1, 2)
    runUnprotected(() => {
      if (reentrant) binding.boundObject.flag = 1
      else edited.count = 2
    })
    const expected =
      kind === "first"
        ? [
            ["a", 2],
            ["b", 0],
            ["c", 0],
          ]
        : [
            ["a", 0],
            ["c", 2],
          ]
    expect(binding.boundObject.items.map((item) => [item.key, item.count])).toEqual(expected)
    expect(binding.boundObject.items.find((item) => item.key === edited.key)).toBe(edited)
    const survivor = original[kind === "first" ? 1 : 0]
    expect(binding.boundObject.items.find((item) => item.key === survivor.key)).toBe(survivor)
    expect((list.get(kind === "first" ? 1 : 0) as LoroMap).id).toBe(
      nativeOriginal[kind === "first" ? 1 : 0].id
    )
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)
