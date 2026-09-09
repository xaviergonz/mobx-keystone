import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { getSnapshot, Model, prop, runUnprotected, types } from "mobx-keystone"
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone, loroBindingContext } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(["a", "z"])(
  "initializing child %s while updating a sibling stays synchronized",
  (key) => {
    @testModel("child")
    class Child extends Model({ value: prop(0) }) {
      onInit() {
        const root = loroBindingContext.get(this)?.boundObject as { count: number } | undefined
        if (root)
          runUnprotected(() => {
            root.count = 100
          })
      }
    }
    const snapshot = getSnapshot(new Child({}))
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    root.set("count", 0)
    doc.commit()
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: types.unchecked<{ count: number; [key: string]: unknown }>(),
    })
    autoDispose(dispose)
    const remote = doc.fork()
    remote.getMap("root").set("count", 5)
    applyJsonObjectToLoroMap(remote.getMap("root").setContainer(key, new LoroMap()), snapshot)
    remote.commit()
    doc.import(remote.export({ mode: "update" }))
    expect(boundObject.count).toBe(100)
    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
  }
)

test("initializing only the incoming model does not serialize the bound root", () => {
  @testModel("local-init-child")
  class Child extends Model({ value: prop(0) }) {
    onInit() {
      this.value = 100
    }
  }
  const snapshot = { ...getSnapshot(new Child({})), value: 0 }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Child),
  })
  autoDispose(dispose)
  applyJsonObjectToLoroMap(root.setContainer("child", new LoroMap()), snapshot)
  const entries = vi.spyOn(LoroMap.prototype, "entries")
  try {
    doc.commit()
    expect(boundObject.child.value).toBe(100)
    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
    expect(
      entries.mock.contexts.filter((value) => value instanceof LoroMap && value.id === root.id)
    ).toHaveLength(0)
  } finally {
    entries.mockRestore()
  }
})

test("reconciled initialization appends to an existing sibling only once", () => {
  @testModel("append-existing-sibling")
  class Child extends Model({ value: prop(0) }) {
    onInit() {
      const root = loroBindingContext.get(this)?.boundObject as { values: number[] } | undefined
      if (root)
        runUnprotected(() => {
          root.values.push(9)
        })
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, { values: [1], other: { value: 1 } })
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.unchecked<{ values: number[] }>(),
  })
  autoDispose(binding.dispose)
  applyJsonObjectToLoroMap(root, { other: { value: 2 }, child: getSnapshot(new Child({})) })
  doc.commit()
  expect(binding.boundObject.values).toEqual([1, 9])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("initialization appends once when the same incoming batch edits the array", () => {
  @testModel("init-edited-array")
  class Child extends Model({ value: prop(0) }) {
    onInit() {
      const root = loroBindingContext.get(this)?.boundObject as { values: number[] } | undefined
      if (root)
        runUnprotected(() => {
          root.values.push(9)
        })
    }
  }
  const snapshot = getSnapshot(new Child({}))
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const values = root.setContainer("values", new LoroMovableList())
  values.push(1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.unchecked<{ values: number[] }>(),
  })
  autoDispose(binding.dispose)
  applyJsonObjectToLoroMap(root.setContainer("child", new LoroMap()), snapshot)
  values.set(0, 5)
  doc.commit()
  expect(binding.boundObject.values).toEqual([5, 9])
  expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
})
