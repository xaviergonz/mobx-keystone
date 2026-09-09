import { LoroDoc, LoroMap } from "loro-crdt"
import { frozen, getSnapshot, idProp, isModel, Model, tProp, types } from "mobx-keystone"
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone, loroBindingContext } from "../../src"
import { autoDispose, testModel } from "../utils"

test("startup native edits win over an overlapping frozen initialization", () => {
  @testModel("frozen-startup-conflict")
  class Root extends Model({
    value: tProp(types.or(types.record(types.number), types.frozen(types.record(types.number)))),
  }) {
    onInit() {
      const context = loroBindingContext.get(this)
      if (!context) return
      this.value = frozen({ local: 7 })
      const native = (context.loroObject as LoroMap).get("value") as LoroMap
      native.set("count", 2)
      context.loroDoc.commit()
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.setContainer("value", new LoroMap()).set("count", 1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
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
        if (loroBindingContext.get(this)) this.count++
      }
    }
    @testModel("startup-replacement-child")
    class Replacement extends Model({ key: idProp, count: tProp(0) }) {
      onInit() {
        if (loroBindingContext.get(this)) this.count += 10
      }
    }
    @testModel("startup-identified-root")
    class Root extends Model({
      child: tProp(
        types.or(types.record(types.or(types.string, types.number)), Child, Replacement)
      ),
    }) {
      onInit() {
        const context = loroBindingContext.get(this)
        if (!context) return
        const child = (context.loroObject as LoroMap).get("child") as LoroMap
        if (kind === "ID") child.set("key", "replacement")
        else if (kind === "type")
          child.set("$modelType", getSnapshot(new Replacement({ key: "original" })).$modelType)
        else child.delete("$modelType")
        context.loroDoc.commit()
      }
    }
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    applyJsonObjectToLoroMap(root, getSnapshot(new Root({ child: new Child({ key: "original" }) })))
    doc.commit()
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
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
      const context = loroBindingContext.get(this)
      if (!context) return
      initialized = this
      this.count++
      ;(context.loroObject as LoroMap).set("key", "replacement")
      context.loroDoc.commit()
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, getSnapshot(new Root({ key: "original" })))
  doc.commit()
  expect(() =>
    bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  ).toThrow("snapshot model id")
  expect(initialized).toBeDefined()
  expect(loroBindingContext.get(initialized!)).toBeUndefined()
  expect(initialized!.count).toBe(1)
})

test("startup plain-to-model replacements initialize from native data", () => {
  @testModel("startup-new-model")
  class Child extends Model({ key: idProp, count: tProp(0) }) {
    onInit() {
      if (loroBindingContext.get(this)) this.count++
    }
  }
  @testModel("startup-plain-to-model-root")
  class Root extends Model({
    child: tProp(types.or(types.record(types.or(types.string, types.number)), Child)),
  }) {
    onInit() {
      const context = loroBindingContext.get(this)
      if (!context) return
      this.child.count = 7
      const child = (context.loroObject as LoroMap).get("child") as LoroMap
      child.set("$modelType", getSnapshot(new Child({ key: "original" })).$modelType)
      context.loroDoc.commit()
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const child = root.setContainer("child", new LoroMap())
  child.set("key", "original")
  child.set("count", 0)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
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
      const context = loroBindingContext.get(this)
      if (!context) return
      initialized()
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.set("$modelType", getSnapshot(new Root({})).$modelType)
  root.set("count", 0)
  doc.commit()
  expect(() =>
    bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  ).toThrow("must contain an id key")
  expect(initialized).not.toHaveBeenCalled()
})
