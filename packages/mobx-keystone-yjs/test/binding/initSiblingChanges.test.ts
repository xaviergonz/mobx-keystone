import { frozen, getSnapshot, Model, prop, runUnprotected, types } from "mobx-keystone"
import * as Y from "yjs"
import {
  bindYjsToMobxKeystone,
  convertJsonToYjsData,
  type YjsTextModel,
  yjsBindingContext,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([false, true])(
  "initialization edits survive sibling updates (child first: %s)",
  (childFirst) => {
    @testModel("init-existing-sibling")
    class Child extends Model({ value: prop(0) }) {
      onInit() {
        const root = yjsBindingContext.get(this)?.boundObject as { count: number } | undefined
        if (root)
          runUnprotected(() => {
            root.count = 100
          })
      }
    }
    const snapshot = getSnapshot(new Child({}))
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    root.set("count", 0)
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: types.unchecked<{ count: number }>(),
    })
    autoDispose(binding.dispose)
    const remote = new Y.Doc()
    autoDispose(() => remote.destroy())
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
    remote.transact(() => {
      if (!childFirst) remote.getMap("root").set("count", 5)
      remote.getMap("root").set("child", convertJsonToYjsData(snapshot))
      if (childFirst) remote.getMap("root").set("count", 5)
    })
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote))
    expect(binding.boundObject.count).toBe(100)
    expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
  }
)

test.each([false, true])(
  "initialization appends to an existing array exactly once (native edit: %s)",
  (nativeEdit) => {
    @testModel("init-array-sibling")
    class Child extends Model({ value: prop(0) }) {
      onInit() {
        const root = yjsBindingContext.get(this)?.boundObject as { values: number[] } | undefined
        if (root)
          runUnprotected(() => {
            root.values.push(9)
          })
      }
    }
    const snapshot = getSnapshot(new Child({}))
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const values = new Y.Array<number>()
    root.set("values", values)
    values.push([1])
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: types.unchecked<{ values: number[] }>(),
    })
    autoDispose(binding.dispose)
    doc.transact(() => {
      root.set("child", convertJsonToYjsData(snapshot))
      if (nativeEdit) {
        values.delete(0, 1)
        values.insert(0, [5])
      }
    })
    expect(binding.boundObject.values).toEqual([nativeEdit ? 5 : 1, 9])
    expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
  }
)

test("initializing only the incoming model does not merge the bound root", () => {
  @testModel("scoped-initialization")
  class Child extends Model({ value: prop(0) }) {
    onInit() {
      this.value = 100
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(Child),
  })
  autoDispose(binding.dispose)
  const keys = vi.spyOn(root, "keys")
  autoDispose(() => keys.mockRestore())
  root.set("child", convertJsonToYjsData({ ...getSnapshot(new Child({})), value: 0 }))
  expect(binding.boundObject.child.value).toBe(100)
  expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
  expect(keys).not.toHaveBeenCalled()
})

test.each(["append", "replace"])("initialization can %s an existing text history", (mode) => {
  @testModel("init-existing-text")
  class Child extends Model({ value: prop(0) }) {
    onInit() {
      const root = yjsBindingContext.get(this)?.boundObject as { text: YjsTextModel } | undefined
      if (root)
        runUnprotected(() => {
          if (mode === "append") root.text.deltaList.push(frozen([{ retain: 3 }, { insert: "!" }]))
          else root.text.deltaList = [frozen([{ insert: "abc!" }])]
        })
    }
  }
  const snapshot = getSnapshot(new Child({}))
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const text = new Y.Text("abc")
  root.set("text", text)
  const binding = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.unchecked<{ text: YjsTextModel }>(),
  })
  autoDispose(binding.dispose)
  root.set("child", convertJsonToYjsData(snapshot))
  expect((root.get("text") as Y.Text).toString()).toBe("abc!")
  expect(binding.boundObject.text.text).toBe("abc!")
})
