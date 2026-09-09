import { frozen, getSnapshot, idProp, isModel, Model, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, convertJsonToYjsData, yjsBindingContext } from "../../src"
import { autoDispose, testModel } from "../utils"

test("startup native edits win over an overlapping frozen initialization", () => {
  @testModel("frozen-startup-conflict")
  class Root extends Model({
    value: tProp(types.or(types.record(types.number), types.frozen(types.record(types.number)))),
  }) {
    onInit() {
      const context = yjsBindingContext.get(this)
      if (!context) return
      this.value = frozen({ local: 7 })
      const native = (context.yjsObject as Y.Map<unknown>).get("value") as Y.Map<unknown>
      native.set("count", 2)
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  root.set("value", new Y.Map([["count", 1]]))
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  expect(getSnapshot(binding.boundObject.value)).toEqual({ count: 2 })
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test.each(["ID", "type", "plain object"])(
  "startup %s replacements do not inherit the old instance's initialization edits",
  (kind) => {
    @testModel("startup-identified-child")
    class Child extends Model({ key: idProp, count: tProp(0) }) {
      onInit() {
        if (yjsBindingContext.get(this)) this.count++
      }
    }
    @testModel("startup-replacement-child")
    class Replacement extends Model({ key: idProp, count: tProp(0) }) {
      onInit() {
        if (yjsBindingContext.get(this)) this.count += 10
      }
    }
    @testModel("startup-identified-root")
    class Root extends Model({
      child: tProp(
        types.or(types.record(types.or(types.string, types.number)), Child, Replacement)
      ),
    }) {
      onInit() {
        const context = yjsBindingContext.get(this)
        if (!context) return
        const child = (context.yjsObject as Y.Map<unknown>).get("child") as Y.Map<unknown>
        if (kind === "ID") child.set("key", "replacement")
        else if (kind === "type")
          child.set("$modelType", getSnapshot(new Replacement({ key: "original" })).$modelType)
        else child.delete("$modelType")
      }
    }
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const snapshot = getSnapshot(new Root({ child: new Child({ key: "original" }) }))
    for (const [key, value] of Object.entries(snapshot)) root.set(key, convertJsonToYjsData(value))
    const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
    autoDispose(binding.dispose)
    expect(binding.boundObject.child.key).toBe(kind === "ID" ? "replacement" : "original")
    expect(isModel(binding.boundObject.child)).toBe(kind !== "plain object")
    if (kind !== "plain object")
      expect(binding.boundObject.child).toBeInstanceOf(kind === "ID" ? Child : Replacement)
    expect(binding.boundObject.child.count).toBe(kind === "ID" ? 1 : kind === "type" ? 10 : 0)
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)

test("startup root identity changes fail without leaving binding context", () => {
  let initialized: Root | undefined
  @testModel("startup-root-id")
  class Root extends Model({ key: idProp, count: tProp(0) }) {
    onInit() {
      const context = yjsBindingContext.get(this)
      if (!context) return
      initialized = this
      this.count++
      ;(context.yjsObject as Y.Map<unknown>).set("key", "replacement")
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  for (const [key, value] of Object.entries(getSnapshot(new Root({ key: "original" }))))
    root.set(key, value)
  expect(() =>
    bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  ).toThrow("snapshot model id")
  expect(initialized).toBeDefined()
  expect(yjsBindingContext.get(initialized!)).toBeUndefined()
  expect(initialized!.count).toBe(1)
})

test("startup plain-to-model replacements initialize from native data", () => {
  @testModel("startup-new-model")
  class Child extends Model({ key: idProp, count: tProp(0) }) {
    onInit() {
      if (yjsBindingContext.get(this)) this.count++
    }
  }
  @testModel("startup-plain-to-model-root")
  class Root extends Model({
    child: tProp(types.or(types.record(types.or(types.string, types.number)), Child)),
  }) {
    onInit() {
      const context = yjsBindingContext.get(this)
      if (!context) return
      this.child.count = 7
      const child = (context.yjsObject as Y.Map<unknown>).get("child") as Y.Map<unknown>
      child.set("$modelType", getSnapshot(new Child({ key: "original" })).$modelType)
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  root.set(
    "child",
    new Y.Map<unknown>([
      ["key", "original"],
      ["count", 0],
    ])
  )
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  expect(binding.boundObject.child).toBeInstanceOf(Child)
  expect(binding.boundObject.child.count).toBe(1)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("startup snapshots with model metadata must include declared IDs", () => {
  const initialized = vi.fn()
  @testModel("startup-generated-id")
  class Root extends Model({ key: idProp, count: tProp(0) }) {
    onInit() {
      const context = yjsBindingContext.get(this)
      if (!context) return
      initialized()
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  root.set("$modelType", getSnapshot(new Root({})).$modelType)
  root.set("count", 0)
  expect(() =>
    bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  ).toThrow("must contain an id key")
  expect(initialized).not.toHaveBeenCalled()
})
