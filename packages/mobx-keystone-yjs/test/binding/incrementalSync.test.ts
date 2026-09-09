import { observe } from "mobx"
import * as mobxKeystone from "mobx-keystone"
import { getSnapshot, idProp, Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import {
  applyJsonObjectToYMap,
  bindYjsToMobxKeystone,
  convertJsonToYjsData,
  YjsTextModel,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("incremental-item")
class Item extends Model({ id: idProp, value: tProp(0) }) {}

test("deleting one array item does not serialize retained models", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<Y.Map<unknown>>("root")
  const values = Array.from(
    { length: 100 },
    (_, i) =>
      convertJsonToYjsData(getSnapshot(new Item({ id: String(i), value: i }))) as Y.Map<unknown>
  )
  array.push(values)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(Item),
  })
  autoDispose(dispose)
  const retained = boundObject[99]
  const reads = vi.spyOn(values[99], "entries")
  autoDispose(() => reads.mockRestore())
  array.delete(0, 1)
  expect(boundObject[98]).toBe(retained)
  expect(boundObject).toHaveLength(99)
  expect(reads).not.toHaveBeenCalled()
})

test("structural edits in different branches do not serialize an unaffected branch", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  applyJsonObjectToYMap(map, { left: [1, 2], right: [3, 4], untouched: [5, 6] })
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.array(types.number)),
  })
  autoDispose(dispose)
  const untouched = map.get("untouched") as Y.Array<number>
  const reads = vi.spyOn(untouched, "map")
  autoDispose(() => reads.mockRestore())
  doc.transact(() => {
    ;(map.get("left") as Y.Array<number>).delete(0, 1)
    ;(map.get("right") as Y.Array<number>).delete(1, 1)
  })
  expect(getSnapshot(boundObject)).toEqual({ left: [2], right: [3], untouched: [5, 6] })
  expect(reads).not.toHaveBeenCalled()
})

test("deleting a primitive array item produces one MobX splice", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  array.push(Array.from({ length: 1000 }, (_, i) => i))
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  const changes = vi.fn()
  autoDispose(observe(boundObject, changes))
  array.delete(0, 1)
  expect(boundObject.slice()).toEqual(array.toArray())
  expect(changes).toHaveBeenCalledTimes(1)
  expect(changes.mock.calls[0][0]).toMatchObject({ type: "splice", index: 0, removed: [0] })
})

@testModel("incremental-text-container")
class TextContainer extends Model({
  items: tProp(types.array(Item), () => []),
  text: tProp(YjsTextModel, () => YjsTextModel.withText("")),
}) {}

test("structural reconciliation retains text delta history from the same transaction", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const text = new Y.Text("abc")
  const items = new Y.Array()
  map.set("text", text)
  map.set("items", items)
  items.push([convertJsonToYjsData(getSnapshot(new Item({ id: "removed" })))])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: TextContainer,
  })
  autoDispose(dispose)
  const initialDelta = boundObject.text.deltaList[0]
  doc.transact(() => {
    items.delete(0, 1)
    text.insert(3, "d")
  })
  expect(boundObject.items).toHaveLength(0)
  expect(boundObject.text.text).toBe("abcd")
  expect(boundObject.text.deltaList).toHaveLength(2)
  expect(boundObject.text.deltaList[0]).toBe(initialDelta)
})

test("encoded remote moves retain model identity and updated data", () => {
  const doc = new Y.Doc()
  const array = doc.getArray("root")
  array.push([
    convertJsonToYjsData(getSnapshot(new Item({ id: "first", value: 1 }))),
    convertJsonToYjsData(getSnapshot(new Item({ id: "second", value: 2 }))),
  ])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(Item),
  })
  autoDispose(dispose)
  const [first, second] = boundObject
  const remote = new Y.Doc()
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
  const remoteArray = remote.getArray("root")
  remote.transact(() => {
    remoteArray.delete(0, 1)
    remoteArray.push([convertJsonToYjsData({ ...getSnapshot(first), value: 10 })])
  })
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)))
  expect(boundObject[0]).toBe(second)
  expect(boundObject[1]).toBe(first)
  expect(first.value).toBe(10)
  expect(getSnapshot(boundObject)).toEqual(remoteArray.toJSON())
})

test("ordinary local edits do not resolve model paths to detect text changes", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  applyJsonObjectToYMap(map, { nested: { values: [1, 2] } })
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.record(types.array(types.number))),
  })
  autoDispose(dispose)
  const resolve = vi.spyOn(mobxKeystone, "resolvePath")
  try {
    runUnprotected(() => {
      boundObject.nested.values.push(3)
      boundObject.nested.values[0] = 4
      boundObject.nested.values = [5, 6]
    })
    expect(map.toJSON()).toEqual({ nested: { values: [5, 6] } })
    expect(resolve).not.toHaveBeenCalled()
  } finally {
    resolve.mockRestore()
  }
})

test("inserting a complete remote model does not merge unrelated models", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<Y.Map<unknown>>("root")
  const retained = convertJsonToYjsData(
    getSnapshot(new Item({ id: "retained", value: 1 }))
  ) as Y.Map<unknown>
  array.push([retained])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(Item),
  })
  autoDispose(dispose)
  const keys = vi.spyOn(retained, "keys")
  try {
    array.push([
      convertJsonToYjsData(getSnapshot(new Item({ id: "new", value: 2 }))) as Y.Map<unknown>,
    ])
    expect(boundObject.map((item) => item.value)).toEqual([1, 2])
    expect(keys).not.toHaveBeenCalled()
  } finally {
    keys.mockRestore()
  }
})

test("ordinary native map updates resolve the model path only once", () => {
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  applyJsonObjectToYMap(root, { nested: { value: 1 } })
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(types.record(types.number)),
  })
  autoDispose(dispose)
  const resolve = vi.spyOn(mobxKeystone, "resolvePath")
  try {
    ;(root.get("nested") as Y.Map<number>).set("value", 2)
    expect(boundObject.nested.value).toBe(2)
    expect(resolve).toHaveBeenCalledTimes(1)
  } finally {
    resolve.mockRestore()
  }
})

test("unrelated helper initialization does not trigger a full binding merge", () => {
  @testModel("unrelated-helper")
  class Helper extends Model({ value: tProp(0) }) {
    onInit() {
      this.value++
    }
  }
  @testModel("helper-owner")
  class Child extends Model({ value: tProp(0) }) {
    onInit() {
      new Helper({})
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const snapshot = getSnapshot(new Child({ value: 1 }))
  root.set("retained", convertJsonToYjsData(snapshot))
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(Child),
  })
  autoDispose(dispose)
  const retained = boundObject.retained
  const keys = vi.spyOn(root, "keys")
  try {
    root.set("added", convertJsonToYjsData(snapshot))
    expect(boundObject.added.value).toBe(1)
    expect(boundObject.retained).toBe(retained)
    expect(root.toJSON()).toEqual(getSnapshot(boundObject))
    expect(keys).not.toHaveBeenCalled()
  } finally {
    keys.mockRestore()
  }
})

test("net-zero sibling edits do not widen structural reconciliation", () => {
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const left = new Y.Array()
  const right = new Y.Array()
  root.set("left", left)
  root.set("right", right)
  left.push([convertJsonToYjsData(getSnapshot(new Item({ id: "removed" })))])
  right.push([convertJsonToYjsData(getSnapshot(new Item({ id: "retained" })))])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(types.array(Item)),
  })
  autoDispose(dispose)
  const retainedSnapshot = getSnapshot(boundObject.right)
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    doc.transact(() => {
      left.delete(0, 1)
      right.insert(0, ["temporary"])
      right.delete(0, 1)
    })
    expect(boundObject.left).toHaveLength(0)
    expect(getSnapshot(boundObject.right)).toBe(retainedSnapshot)
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][0]).toBe(boundObject.left)
  } finally {
    apply.mockRestore()
  }
})

test("temporary sibling map keys do not widen structural reconciliation", () => {
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const left = new Y.Map()
  const right = new Y.Map()
  root.set("left", left)
  root.set("right", right)
  left.set("item", convertJsonToYjsData(getSnapshot(new Item({ id: "removed" }))))
  right.set("item", convertJsonToYjsData(getSnapshot(new Item({ id: "retained" }))))
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(types.record(Item)),
  })
  autoDispose(dispose)
  const retainedSnapshot = getSnapshot(boundObject.right)
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    doc.transact(() => {
      left.delete("item")
      right.set("temporary", 1)
      right.delete("temporary")
    })
    expect(getSnapshot(boundObject.left)).toEqual({})
    expect(getSnapshot(boundObject.right)).toBe(retainedSnapshot)
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][0]).toBe(boundObject.left)
  } finally {
    apply.mockRestore()
  }
})

test("net-zero text edits do not widen structural reconciliation", () => {
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const left = new Y.Array()
  const right = new Y.Text("retained")
  root.set("left", left)
  root.set("right", right)
  left.push([convertJsonToYjsData(getSnapshot(new Item({ id: "removed" })))])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(types.or(types.array(Item), YjsTextModel)),
  })
  autoDispose(dispose)
  const retainedSnapshot = getSnapshot(boundObject.right)
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    doc.transact(() => {
      left.delete(0, 1)
      right.insert(0, "temporary")
      right.delete(0, 9)
    })
    expect(getSnapshot(boundObject.left)).toEqual([])
    expect(getSnapshot(boundObject.right)).toBe(retainedSnapshot)
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][0]).toBe(boundObject.left)
  } finally {
    apply.mockRestore()
  }
})
