import { observe } from "mobx"
import * as mobxKeystone from "mobx-keystone"
import { getSnapshot, idProp, Model, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, convertJsonToYjsData } from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("incremental-item")
class Item extends Model({ id: idProp, value: tProp(0) }) {}

test.each([1, 10_000])(
  "native array replacements preserve fixed-length refinements (%s items)",
  (length) => {
    @testModel("fixed-length-root")
    class Root extends Model({
      values: tProp(
        types.refinement(types.array(types.number), (values) => values.length === length)
      ),
    }) {}
    const doc = new Y.Doc()
    const map = doc.getMap("root")
    const array = new Y.Array<number>()
    array.push(Array.from({ length }, () => 1))
    map.set("values", array)
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: map,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    const changes = vi.fn()
    autoDispose(observe(boundObject.values, changes))
    const replacement = Array.from({ length }, () => 2)
    doc.transact(() => {
      array.delete(0, length)
      array.insert(0, replacement)
    })
    expect(boundObject.values.slice()).toEqual(replacement)
    expect(changes).toHaveBeenCalledTimes(1)
    for (const [change] of changes.mock.calls) {
      expect(change.removed.length).toBe(change.added.length)
      expect(change.removed.every((value: number) => value === 1)).toBe(true)
      expect(change.added.every((value: number) => value === 2)).toBe(true)
    }
  }
)

test("separated replacements in an array without a typed model remain incremental", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  array.push(Array.from({ length: 20_000 }, () => 0))
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  const changes = vi.fn()
  const stop = observe(boundObject, changes)
  try {
    doc.transact(() => {
      array.delete(0, 1)
      array.insert(0, [1])
      array.delete(19_999, 1)
      array.insert(19_999, [2])
    })
    expect(boundObject[0]).toBe(1)
    expect(boundObject[19_999]).toBe(2)
    expect(apply).not.toHaveBeenCalled()
    expect(changes).toHaveBeenCalledTimes(2)
    for (const [change] of changes.mock.calls) {
      expect(change.removed).toHaveLength(1)
      expect(change.added).toHaveLength(1)
    }
  } finally {
    stop()
    apply.mockRestore()
  }
})

test("large native replacements validate the complete array", () => {
  const previous = mobxKeystone.getGlobalConfig().modelAutoTypeChecking
  mobxKeystone.setGlobalConfig({
    modelAutoTypeChecking: mobxKeystone.ModelAutoTypeCheckingMode.AlwaysOn,
  })
  autoDispose(() => mobxKeystone.setGlobalConfig({ modelAutoTypeChecking: previous }))

  @testModel("uniform-array-root")
  class Root extends Model({
    values: tProp(
      types.refinement(types.array(types.number), (values) =>
        values.every((value) => value === values[0])
      )
    ),
  }) {}
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const array = new Y.Array<number>()
  array.push(Array.from({ length: 10_000 }, () => 1))
  map.set("values", array)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  doc.transact(() => {
    array.delete(0, array.length)
    array.insert(
      0,
      Array.from({ length: 10_000 }, () => 2)
    )
  })
  expect(boundObject.values.every((value) => value === 2)).toBe(true)
})

test("combining typed array edits preserves retained models and limits the splice range", () => {
  @testModel("retained-range-root")
  class Root extends Model({ values: tProp(types.array(types.or(types.number, Item))) }) {}
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const array = new Y.Array<unknown>()
  const initial: unknown[] = Array.from({ length: 10_000 }, () => 0)
  initial[5001] = convertJsonToYjsData(getSnapshot(new Item({ id: "retained" })))
  array.push(initial)
  map.set("values", array)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const retained = boundObject.values[5001]
  const changes = vi.fn()
  autoDispose(observe(boundObject.values, changes))
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    doc.transact(() => {
      array.delete(5000, 1)
      array.insert(5000, [1])
      array.delete(5002, 1)
      array.insert(5002, [2])
    })
    expect(boundObject.values[5001]).toBe(retained)
    expect(boundObject.values[5000]).toBe(1)
    expect(boundObject.values[5002]).toBe(2)
    expect(boundObject.values).toHaveLength(10_000)
    expect(changes).toHaveBeenCalledTimes(1)
    expect(changes.mock.calls[0][0].index).toBe(5000)
    expect(changes.mock.calls[0][0].removed).toHaveLength(3)
    expect(changes.mock.calls[0][0].added).toHaveLength(3)
    expect(apply).not.toHaveBeenCalled()
  } finally {
    apply.mockRestore()
  }
})

test("disabled type checking keeps sparse typed array edits incremental", () => {
  @testModel("unchecked-array-root")
  class Root extends Model({ values: tProp(types.array(types.number)) }) {}
  const previous = mobxKeystone.getGlobalConfig().modelAutoTypeChecking
  mobxKeystone.setGlobalConfig({
    modelAutoTypeChecking: mobxKeystone.ModelAutoTypeCheckingMode.AlwaysOff,
  })
  try {
    const doc = new Y.Doc()
    const map = doc.getMap("root")
    const array = new Y.Array<number>()
    array.push(Array.from({ length: 10_000 }, () => 0))
    map.set("values", array)
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: map,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    const changes = vi.fn()
    autoDispose(observe(boundObject.values, changes))
    doc.transact(() => {
      array.delete(0, 1)
      array.insert(0, [1])
      array.delete(9999, 1)
      array.insert(9999, [2])
    })
    expect(boundObject.values[0]).toBe(1)
    expect(boundObject.values[9999]).toBe(2)
    expect(changes).toHaveBeenCalledTimes(2)
    for (const [change] of changes.mock.calls) expect(change.added).toHaveLength(1)
  } finally {
    mobxKeystone.setGlobalConfig({ modelAutoTypeChecking: previous })
  }
})

test("separated native array replacements preserve whole-array refinements", () => {
  const previous = mobxKeystone.getGlobalConfig().modelAutoTypeChecking
  mobxKeystone.setGlobalConfig({
    modelAutoTypeChecking: mobxKeystone.ModelAutoTypeCheckingMode.AlwaysOn,
  })
  autoDispose(() => mobxKeystone.setGlobalConfig({ modelAutoTypeChecking: previous }))

  @testModel("balanced-array-root")
  class Root extends Model({
    values: tProp(
      types.refinement(
        types.array(types.number),
        (values) => values.reduce((a, b) => a + b, 0) === 4
      )
    ),
  }) {}
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const array = new Y.Array<number>()
  array.push([1, 0, 3])
  map.set("values", array)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const changes = vi.fn()
  autoDispose(observe(boundObject.values, changes))
  doc.transact(() => {
    array.delete(0, 1)
    array.insert(0, [3])
    array.delete(2, 1)
    array.insert(2, [1])
  })
  expect(boundObject.values.slice()).toEqual([3, 0, 1])
  expect(changes).toHaveBeenCalledTimes(1)
  expect(changes.mock.calls[0][0].type).toBe("splice")
})
