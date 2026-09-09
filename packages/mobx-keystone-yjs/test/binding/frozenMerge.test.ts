import { observe } from "mobx"
import { frozen, getSnapshot, types } from "mobx-keystone"
import * as Y from "yjs"
import {
  applyJsonArrayToYArray,
  applyJsonObjectToYMap,
  bindYjsToMobxKeystone,
  YjsTextModel,
} from "../../src"
import { autoDispose } from "../utils"

test("merging unchanged NaN values does not publish Yjs updates", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const snapshot = { value: Number.NaN, items: [Number.NaN] }
  applyJsonObjectToYMap(map, snapshot)
  const update = vi.fn()
  doc.on("update", update)
  applyJsonObjectToYMap(map, snapshot, { mode: "merge" })
  expect(map.toJSON()).toEqual(snapshot)
  expect(update).not.toHaveBeenCalled()
})

test("merging negative zero preserves its sign in maps and arrays", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  applyJsonObjectToYMap(map, { value: 0, items: [0] })
  applyJsonObjectToYMap(map, { value: -0, items: [-0] }, { mode: "merge" })
  expect(map.get("value")).toBe(-0)
  expect((map.get("items") as Y.Array<number>).get(0)).toBe(-0)
  const remote = new Y.Doc()
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
  expect(remote.getMap("root").toJSON()).toEqual({ value: -0, items: [-0] })
})

test("merging frozen values preserves signed zero", () => {
  const map = new Y.Doc().getMap("root")
  applyJsonObjectToYMap(map, { value: { $frozen: true, data: { number: 0 } } })
  applyJsonObjectToYMap(map, { value: { $frozen: true, data: { number: -0 } } }, { mode: "merge" })
  expect((map.get("value") as { data: { number: number } }).data.number).toBe(-0)
})

test("merging unchanged frozen JSON permits object method names as keys", () => {
  const map = new Y.Doc().getMap("root")
  const source = () => ({ value: { $frozen: true, data: { valueOf: 1, toString: "text" } } })
  applyJsonObjectToYMap(map, source())
  const retained = map.get("value")
  const update = vi.fn()
  map.doc!.on("update", update)
  applyJsonObjectToYMap(map, source(), { mode: "merge" })
  expect(map.get("value")).toBe(retained)
  expect(update).not.toHaveBeenCalled()
})

test("array merges compare nested frozen JSON without invoking object methods", () => {
  const array = new Y.Doc().getArray("root")
  const value = (number: number) => ({
    $frozen: true,
    data: [{ valueOf: 1, number, nan: Number.NaN }],
  })
  applyJsonArrayToYArray(array, [value(0)])
  applyJsonArrayToYArray(array, [value(-0)], { mode: "merge" })
  expect((array.get(0) as ReturnType<typeof value>).data[0].number).toBe(-0)
  const retained = array.get(0)
  const update = vi.fn()
  array.doc!.on("update", update)
  applyJsonArrayToYArray(array, [value(-0)], { mode: "merge" })
  expect(array.get(0)).toBe(retained)
  expect(update).not.toHaveBeenCalled()
})

test("text merge comparison treats attribute method names as JSON data", () => {
  const map = new Y.Doc().getMap("root")
  const snapshot = {
    text: getSnapshot(
      new YjsTextModel({
        deltaList: [frozen([{ insert: "a", attributes: { valueOf: 1, toString: "text" } }])],
      })
    ),
  } as unknown as Parameters<typeof applyJsonObjectToYMap>[1]
  applyJsonObjectToYMap(map, snapshot)
  const retained = map.get("text") as Y.Text
  const position = Y.createRelativePositionFromTypeIndex(retained, 0)
  const update = vi.fn()
  map.doc!.on("update", update)
  applyJsonObjectToYMap(map, snapshot, { mode: "merge" })
  expect(map.get("text")).toBe(retained)
  expect(retained.toDelta()).toEqual([
    { insert: "a", attributes: { valueOf: 1, toString: "text" } },
  ])
  expect(Y.createAbsolutePositionFromRelativePosition(position, map.doc!)?.index).toBe(0)
  expect(update).not.toHaveBeenCalled()
})

test("repeating a native frozen map value preserves its bound wrapper", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const value = { $frozen: true, data: { numbers: [1, 2, 3] } }
  map.set("value", value)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.frozen(types.unchecked<{ numbers: number[] }>())),
  })
  autoDispose(dispose)
  const retained = boundObject.value
  const snapshot = getSnapshot(boundObject)
  const changes = vi.fn()
  autoDispose(observe(boundObject, changes))
  map.set("value", value)
  expect(boundObject.value).toBe(retained)
  expect(getSnapshot(boundObject)).toBe(snapshot)
  expect(changes).not.toHaveBeenCalled()
  map.set("value", { $frozen: true, data: { numbers: [4] } })
  expect(boundObject.value.data.numbers).toEqual([4])
  expect(changes).toHaveBeenCalledTimes(1)
})
