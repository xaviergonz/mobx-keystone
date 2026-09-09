import { LoroDoc, LoroMap } from "loro-crdt"
import * as mobxKeystone from "mobx-keystone"
import { getSnapshot, Model, tProp, types } from "mobx-keystone"
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("native updates use stored transformed values", () => {
  @testModel("transformed")
  class Root extends Model({
    value: tProp(10).withTransform({
      transform: ({ originalValue }) => originalValue * 2,
      untransform: ({ transformedValue }: { transformedValue: number }) => transformedValue / 2,
    }),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  root.set("value", 30)
  doc.commit()
  expect(binding.boundObject.value).toBe(60)
  expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
})

test.each(["delete", "null"])("native %s restores model defaults", (mode) => {
  @testModel("default")
  class Root extends Model({ value: tProp(types.number, 5) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  if (mode === "delete") root.delete("value")
  else root.set("value", null)
  doc.commit()
  expect(binding.boundObject.value).toBe(5)
  expect(root.get("value")).toBe(5)
})

test("native model updates run snapshot normalization", () => {
  @testModel("normalized")
  class Root extends Model(
    { value: tProp(types.number, 0) },
    {
      fromSnapshotProcessor: (snapshot: { value: number }) => ({
        ...snapshot,
        value: Math.round(snapshot.value),
      }),
    }
  ) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.set("value", 1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  root.set("value", 2.7)
  doc.commit()
  expect(binding.boundObject.value).toBe(3)
  expect(root.get("value")).toBe(3)
})

test("nested processors write normalized values back without reading the root", () => {
  @testModel("nested-normalized")
  class Child extends Model(
    { value: tProp(types.number, 0) },
    {
      fromSnapshotProcessor: (snapshot: { value: number }) => ({
        ...snapshot,
        value: Math.round(snapshot.value),
      }),
    }
  ) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const child = root.setContainer("child", new LoroMap())
  applyJsonObjectToLoroMap(child, getSnapshot(new Child({ value: 1 })))
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Child),
  })
  autoDispose(binding.dispose)
  const read = vi.spyOn(LoroMap.prototype, "entries")
  try {
    child.set("value", 2.7)
    doc.commit()
    expect(binding.boundObject.child.value).toBe(3)
    expect(child.get("value")).toBe(3)
    expect(
      read.mock.contexts.filter((context) => context instanceof LoroMap && context.id === root.id)
    ).toHaveLength(0)
  } finally {
    read.mockRestore()
  }
})

test("repeating model metadata with a scalar update does not create a data property", () => {
  @testModel("repeated-type")
  class Root extends Model({ value: tProp(1) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  root.set("$modelType", getSnapshot(binding.boundObject).$modelType)
  root.set("value", 2)
  doc.commit()
  expect(binding.boundObject.value).toBe(2)
  expect(Object.hasOwn(binding.boundObject.$, "$modelType")).toBe(false)
})

test("identity snapshot processors keep scalar updates incremental", () => {
  @testModel("identity-processor")
  class Root extends Model(
    { value: tProp(1) },
    { fromSnapshotProcessor: (snapshot) => snapshot }
  ) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    root.set("value", 2)
    doc.commit()
    expect(binding.boundObject.value).toBe(2)
    expect(apply).not.toHaveBeenCalled()
  } finally {
    apply.mockRestore()
  }
})

test.each(["delete", "null"])("shifted untyped models restore defaults after native %s", (mode) => {
  @testModel("shifted-untyped")
  class Child extends Model({ value: mobxKeystone.prop(5) }) {}
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  list.push(0)
  const child = list.pushContainer(new LoroMap())
  applyJsonObjectToLoroMap(child, getSnapshot(new Child({})))
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.or(types.number, Child)),
  })
  autoDispose(binding.dispose)
  list.delete(0, 1)
  if (mode === "delete") child.delete("value")
  else child.set("value", null)
  doc.commit()
  expect((binding.boundObject[0] as Child).value).toBe(5)
  expect(child.get("value")).toBe(5)
})

test("reverted native model values skip snapshot processing", () => {
  const processor = vi.fn((snapshot: { value: number }) => snapshot)
  @testModel("reverted-processor")
  class Root extends Model({ value: tProp(1) }, { fromSnapshotProcessor: processor }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.set("value", 1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  processor.mockClear()
  root.set("value", 2)
  root.set("value", 1)
  doc.commit()
  expect(binding.boundObject.value).toBe(1)
  expect(processor).not.toHaveBeenCalled()
})

test("unchanged model discriminators keep scalar updates incremental", () => {
  @testModel("unchanged-discriminator")
  class Child extends Model({ value: tProp(1) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, { child: getSnapshot(new Child({})) })
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Child),
  })
  autoDispose(binding.dispose)
  const child = root.get("child") as LoroMap
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  autoDispose(() => apply.mockRestore())
  child.set("$modelType", child.get("$modelType"))
  child.set("value", 2)
  doc.commit()
  expect(binding.boundObject.child.value).toBe(2)
  expect(apply).not.toHaveBeenCalled()
})
