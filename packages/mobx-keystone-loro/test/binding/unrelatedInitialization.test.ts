import { LoroDoc, LoroMap } from "loro-crdt"
import { getSnapshot, Model, prop, types } from "mobx-keystone"
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("initializing an unrelated helper does not commit pending document edits", () => {
  @testModel("helper")
  class Helper extends Model({ value: prop(0) }) {
    onInit() {
      this.value++
    }
  }
  @testModel("root")
  class Root extends Model({ value: prop(0) }) {
    onInit() {
      new Helper({})
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, getSnapshot(new Root({})))
  doc.commit()
  doc.getMap("unrelated").set("value", 1)
  const commit = vi.spyOn(doc, "commit")
  try {
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
    expect(commit.mock.calls.length).toBe(0)
    expect(doc.getPendingTxnLength()).toBeGreaterThan(0)
  } finally {
    commit.mockRestore()
  }
})

test("an incoming model's unrelated helper does not trigger an extra commit", () => {
  @testModel("incoming-helper")
  class Helper extends Model({ value: prop(0) }) {
    onInit() {
      this.value++
    }
  }
  @testModel("incoming-child")
  class Child extends Model({ value: prop(0) }) {
    onInit() {
      new Helper({})
    }
  }
  const snapshot = getSnapshot(new Child({}))
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Child),
  })
  autoDispose(dispose)
  applyJsonObjectToLoroMap(root.setContainer("child", new LoroMap()), snapshot)
  const commit = vi.spyOn(doc, "commit")
  try {
    doc.commit()
    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
    expect(commit.mock.calls.length).toBe(1)
  } finally {
    commit.mockRestore()
  }
})
