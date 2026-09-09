import * as mobxKeystone from "mobx-keystone"
import { getSnapshot, Model, modelSnapshotOutWithMetadata, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import {
  bindYjsToMobxKeystone,
  convertJsonToYjsData,
  YjsTextModel,
  yjsBindingContext,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([
  ["array", false],
  ["map", false],
  ["text", false],
  ["array", true],
  ["map", true],
  ["text", true],
] as const)(
  "native %s edits during initialization are retained (open transaction: %s)",
  (kind, openTransaction) => {
    const valueType =
      kind === "array"
        ? types.array(types.number)
        : kind === "map"
          ? types.record(types.number)
          : YjsTextModel
    @testModel("native-initialization-root")
    class Root extends Model({ value: tProp(valueType), local: tProp(0) }) {
      onInit() {
        this.local = 7
        const ctx = yjsBindingContext.get(this)!
        const value = (ctx.yjsObject as Y.Map<unknown>).get("value")
        if (value instanceof Y.Array) value.push([2])
        else if (value instanceof Y.Map) {
          value.delete("removed")
          value.set("added", 2)
        } else if (value instanceof Y.Text) value.insert(1, "b")
      }
    }
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const value =
      kind === "array" ? new Y.Array<number>() : kind === "map" ? new Y.Map<number>() : new Y.Text()
    root.set("value", value)
    if (value instanceof Y.Array) value.push([1])
    else if (value instanceof Y.Map) value.set("removed", 1)
    else value.insert(0, "a")
    const bind = () =>
      bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
    let binding: ReturnType<typeof bind> | undefined
    if (openTransaction)
      doc.transact(() => {
        binding = bind()
      })
    else binding = bind()
    const { boundObject, dispose } = binding!
    autoDispose(dispose)
    expect(boundObject.local).toBe(7)
    expect(root.get("local")).toBe(7)
    if (boundObject.value instanceof YjsTextModel) {
      expect(value.toJSON()).toBe("ab")
      dispose()
      expect(boundObject.value.text).toBe("ab")
    } else {
      const expected = kind === "array" ? [1, 2] : { added: 2 }
      expect(value.toJSON()).toEqual(expected)
      expect(getSnapshot(boundObject.value)).toEqual(expected)
    }
  }
)

test("native edits from newly initialized descendants are included before writeback", () => {
  @testModel("native-initialization-child")
  class Child extends Model({ value: tProp(1) }) {
    onInit() {
      const ctx = yjsBindingContext.get(this)!
      const values = (ctx.yjsObject as Y.Map<Y.Array<number>>).get("values")!
      values.push([2])
    }
  }
  @testModel("native-initialization-parent")
  class Root extends Model({
    values: tProp(types.array(types.number)),
    child: tProp(types.maybe(Child)),
  }) {
    onInit() {
      const ctx = yjsBindingContext.get(this)!
      ;(ctx.yjsObject as Y.Map<unknown>).set(
        "child",
        convertJsonToYjsData(modelSnapshotOutWithMetadata(Child, { value: 1 }))
      )
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const values = new Y.Array<number>()
  root.set("values", values)
  values.push([1])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  expect(getSnapshot(boundObject.values)).toEqual([1, 2])
  expect(boundObject.child?.value).toBe(1)
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test("native initialization changes take precedence on overlapping fields", () => {
  @testModel("native-initialization-overlap")
  class Root extends Model({ value: tProp(0) }) {
    onInit() {
      this.value = 7
      const ctx = yjsBindingContext.get(this)!
      ;(ctx.yjsObject as Y.Map<number>).set("value", 2)
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap<number>("root")
  root.set("value", 1)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  expect(boundObject.value).toBe(2)
  expect(root.get("value")).toBe(2)
})

test("destroying the document during initialization does not publish a binding", () => {
  let created: Root | undefined
  @testModel("native-initialization-destroy")
  class Root extends Model({ value: tProp(0) }) {
    onInit() {
      created = this
      yjsBindingContext.get(this)!.yjsDoc.destroy()
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  expect(() =>
    bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  ).toThrow("deleted during initialization")
  expect(yjsBindingContext.get(created!)).toBeUndefined()
})

test("unchanged native input avoids snapshot reconciliation during startup", () => {
  @testModel("native-initialization-noop")
  class Root extends Model({ values: tProp(types.array(types.number)), local: tProp(0) }) {
    onInit() {
      this.local = 7
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const values = new Y.Array<number>()
  root.set("values", values)
  values.push(Array.from({ length: 10000 }, () => 1))
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  autoDispose(() => apply.mockRestore())
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  expect(boundObject.values).toHaveLength(10000)
  expect(boundObject.local).toBe(7)
  expect(apply).not.toHaveBeenCalled()
})
