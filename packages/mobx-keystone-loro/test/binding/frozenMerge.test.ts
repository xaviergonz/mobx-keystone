import { LoroDoc } from "loro-crdt"
import { getSnapshot, Model, toFrozenSnapshot, tProp, types } from "mobx-keystone"
import {
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  bindLoroToMobxKeystone,
} from "../../src"

import { autoDispose, testModel } from "../utils"

test.each(["map", "list"])(
  "merging equal frozen values into a %s creates no operations",
  (kind) => {
    const doc = new LoroDoc()
    const apply = (value: number) => {
      const snapshot = toFrozenSnapshot({ nested: [value, { label: "same" }] })
      if (kind === "map") {
        applyJsonObjectToLoroMap(doc.getMap("root"), { value: snapshot }, { mode: "merge" })
      } else {
        applyJsonArrayToLoroMovableList(doc.getMovableList("root"), [snapshot], { mode: "merge" })
      }
    }
    apply(1)
    doc.commit()
    apply(1)
    expect(doc.getPendingTxnLength()).toBe(0)
    apply(2)
    expect(doc.getPendingTxnLength()).toBeGreaterThan(0)
    const snapshot = toFrozenSnapshot({ nested: [2, { label: "same" }] })
    expect(
      kind === "map" ? doc.getMap("root").toJSON() : doc.getMovableList("root").toJSON()
    ).toEqual(kind === "map" ? { value: snapshot } : [snapshot])
  }
)

test("merging an unchanged frozen list value does not compete with a concurrent edit", () => {
  const doc = new LoroDoc()
  doc.setPeerId("2")
  const list = doc.getMovableList("root")
  const initial = toFrozenSnapshot({ value: 1 })
  applyJsonArrayToLoroMovableList(list, [initial])
  doc.commit()
  const remote = doc.fork()
  remote.setPeerId("1")
  const edited = toFrozenSnapshot({ value: 2 })
  remote.getMovableList("root").set(0, edited)
  remote.commit()
  applyJsonArrayToLoroMovableList(list, [toFrozenSnapshot({ value: 1 })], { mode: "merge" })
  doc.commit()
  doc.import(remote.export({ mode: "update" }))
  expect(list.toJSON()).toEqual([edited])
})

test("repeated native frozen values retain their model and snapshot references", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const snapshot = toFrozenSnapshot({ valueOf: 1, nested: [2] })
  root.set("value", snapshot)
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.frozen(types.unchecked())),
  })
  autoDispose(binding.dispose)
  const value = binding.boundObject.value
  const before = getSnapshot(binding.boundObject)
  root.set("value", snapshot)
  doc.commit()
  expect(binding.boundObject.value).toBe(value)
  expect(getSnapshot(binding.boundObject)).toBe(before)
})

test("repeated frozen model properties retain their references", () => {
  @testModel("frozen-property")
  class Root extends Model({ value: tProp(types.frozen(types.unchecked())) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const snapshot = toFrozenSnapshot({ valueOf: 1 })
  root.set("value", snapshot)
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const before = binding.boundObject.value
  root.set("value", snapshot)
  doc.commit()
  expect(binding.boundObject.value).toBe(before)
})

test.each(["map", "list"])("equivalent frozen constructor fields do not write to a %s", (kind) => {
  const doc = new LoroDoc()
  const snapshot = () => toFrozenSnapshot({ constructor: { nested: 1 } })
  const merge = () => {
    if (kind === "map")
      applyJsonObjectToLoroMap(doc.getMap("root"), { value: snapshot() }, { mode: "merge" })
    else
      applyJsonArrayToLoroMovableList(doc.getMovableList("root"), [snapshot()], { mode: "merge" })
  }
  merge()
  doc.commit()
  merge()
  expect(doc.getPendingTxnLength()).toBe(0)
})

test.each(["map", "list"])(
  "numeric merges respect native signed-zero normalization in a %s",
  (kind) => {
    const doc = new LoroDoc()
    const merge = (value: number) => {
      if (kind === "map") applyJsonObjectToLoroMap(doc.getMap("root"), { value }, { mode: "merge" })
      else applyJsonArrayToLoroMovableList(doc.getMovableList("root"), [value], { mode: "merge" })
    }
    merge(0)
    doc.commit()
    merge(-0)
    const value =
      kind === "map" ? doc.getMap("root").get("value") : doc.getMovableList("root").get(0)
    expect(Object.is(value, 0)).toBe(true)
    expect(doc.getPendingTxnLength()).toBe(0)
  }
)
