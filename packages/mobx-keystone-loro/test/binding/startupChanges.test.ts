import { LoroDoc, LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { reaction } from "mobx"
import { getSnapshot, Model, modelSnapshotOutWithMetadata, tProp, types } from "mobx-keystone"
import {
  applyJsonObjectToLoroMap,
  bindLoroToMobxKeystone,
  LoroTextModel,
  loroBindingContext,
} from "../../src"
import type { PlainObject } from "../../src/plainTypes"
import { autoDispose, testModel } from "../utils"

test.each(
  ["initialization", "activation"].flatMap((phase) =>
    ["array", "map", "text"].flatMap((kind) =>
      [false, true].map((pending) => ({ phase, kind, pending }))
    )
  )
)(
  "native $kind changes during $phase are retained (pending: $pending)",
  ({ phase, kind, pending }) => {
    const valueType =
      kind === "array"
        ? types.array(types.number)
        : kind === "map"
          ? types.record(types.number)
          : LoroTextModel
    @testModel("startup-native-root")
    class Root extends Model({ value: tProp(valueType), local: tProp(0) }) {
      onInit() {
        this.local = 7
        const ctx = loroBindingContext.get(this)
        if (!ctx) return
        const edit = () => {
          const value = ctx.loroDoc.getMap("root").get("value")
          if (value instanceof LoroMovableList) value.push(2)
          else if (value instanceof LoroMap) {
            value.delete("removed")
            value.set("added", 2)
          } else if (value instanceof LoroText) value.insert(1, "b")
          ctx.loroDoc.commit()
        }
        if (phase === "initialization") edit()
        else
          autoDispose(
            reaction(
              () => loroBindingContext.get(this)?.boundObject,
              (bound) => {
                if (bound) edit()
              }
            )
          )
      }
    }
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const seed = new Root({
      value: kind === "array" ? [1] : kind === "map" ? { removed: 1 } : LoroTextModel.withText("a"),
    })
    applyJsonObjectToLoroMap(root, getSnapshot(seed) as unknown as PlainObject)
    if (!pending) {
      root.set("local", 0)
      doc.commit()
    }
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(binding.dispose)
    const value = root.get("value") as LoroMap | LoroMovableList | LoroText
    const expected = kind === "array" ? [1, 2] : kind === "map" ? { added: 2 } : "ab"
    expect(value.toJSON()).toEqual(expected)
    if (binding.boundObject.value instanceof LoroTextModel) {
      binding.dispose()
      expect(binding.boundObject.value.text).toBe("ab")
    } else expect(getSnapshot(binding.boundObject.value)).toEqual(expected)
    expect(binding.boundObject.local).toBe(7)
    expect(root.get("local")).toBe(7)
  }
)

test("native edits from newly initialized descendants are included before writeback", () => {
  @testModel("native-startup-child")
  class Child extends Model({ value: tProp(1) }) {
    onInit() {
      const ctx = loroBindingContext.get(this)!
      const values = (ctx.loroObject as LoroMap).get("values") as LoroMovableList
      values.push(2)
      ctx.loroDoc.commit()
    }
  }
  @testModel("native-startup-parent")
  class Root extends Model({
    values: tProp(types.array(types.number)),
    child: tProp(types.maybe(Child)),
  }) {
    onInit() {
      const ctx = loroBindingContext.get(this)!
      const child = (ctx.loroObject as LoroMap).setContainer("child", new LoroMap())
      applyJsonObjectToLoroMap(child, modelSnapshotOutWithMetadata(Child, { value: 1 }))
      ctx.loroDoc.commit()
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.setContainer("values", new LoroMovableList()).push(1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  expect(binding.boundObject.values).toEqual([1, 2])
  expect(binding.boundObject.child?.value).toBe(1)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("deleting the bound container during initialization clears its temporary context", () => {
  let created: Root | undefined
  @testModel("deleted-startup-root")
  class Root extends Model({ value: tProp(0) }) {
    onInit() {
      created = this
      const ctx = loroBindingContext.get(this)!
      ctx.loroDoc.getMap("parent").delete("child")
      ctx.loroDoc.commit()
    }
  }
  const doc = new LoroDoc()
  const child = doc.getMap("parent").setContainer("child", new LoroMap())
  doc.commit()
  expect(() =>
    bindLoroToMobxKeystone({ loroDoc: doc, loroObject: child, mobxKeystoneType: Root })
  ).toThrow("deleted during initialization")
  expect(loroBindingContext.get(created!)).toBeUndefined()
})
