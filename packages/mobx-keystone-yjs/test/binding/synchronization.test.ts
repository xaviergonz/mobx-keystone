import { observe } from "mobx"
import { frozen, getSnapshot, idProp, Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import {
  applyJsonArrayToYArray,
  applyJsonObjectToYMap,
  bindYjsToMobxKeystone,
  convertJsonToYjsData,
  YjsTextModel,
  yjsBindingContext,
} from "../../src"
import { autoDispose, testModel } from "../utils"

function bindText() {
  const doc = new Y.Doc()
  const text = doc.getText("text")
  text.insert(0, "abc")
  const binding = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: text,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(binding.dispose)
  return { doc, text, ...binding }
}

test("remote text edits are applied with a live context flag and without feedback", () => {
  const { text, boundObject, yjsOrigin } = bindText()
  const flags: boolean[] = []
  autoDispose(
    observe(boundObject.deltaList, () =>
      flags.push(yjsBindingContext.get(boundObject)!.isApplyingYjsChangesToMobxKeystone)
    )
  )
  const origins: unknown[] = []
  text.observe((event) => origins.push(event.transaction.origin))
  text.insert(3, "d")
  expect(flags).toEqual([true])
  expect(origins).not.toContain(yjsOrigin)
  expect(text.toString()).toBe("abcd")
})

test("appending text deltas preserves existing Yjs positions", () => {
  const { doc, text, boundObject } = bindText()
  const position = Y.createRelativePositionFromTypeIndex(text, 1)
  runUnprotected(() => boundObject.deltaList.push(frozen([{ retain: 3 }, { insert: "d" }])))
  expect(text.toString()).toBe("abcd")
  expect(Y.createAbsolutePositionFromRelativePosition(position, doc)?.index).toBe(1)
})

test("replacing the delta list synchronizes text and observes subsequent edits", () => {
  const { text, boundObject } = bindText()
  runUnprotected(() => {
    boundObject.deltaList = [frozen([{ insert: "xyz" }])]
    boundObject.deltaList.push(frozen([{ retain: 3 }, { insert: "!" }]))
  })
  expect(text.toString()).toBe("xyz!")
  runUnprotected(() => boundObject.deltaList.push(frozen([{ retain: 4 }, { insert: "?" }])))
  expect(text.toString()).toBe("xyz!?")
})

test("disposing a text binding stops synchronization in both directions", () => {
  const { text, boundObject, dispose } = bindText()
  dispose()
  runUnprotected(() => boundObject.deltaList.push(frozen([{ retain: 3 }, { insert: "d" }])))
  expect(text.toString()).toBe("abc")
  text.insert(0, "remote")
  expect(boundObject.text).toBe("abcd")
})

test("merge reapplies the same snapshot after nested Yjs changes in the same transaction", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("map")
  const snapshot = { nested: { value: 1 }, array: [1, 2] }
  applyJsonObjectToYMap(map, snapshot, { mode: "merge" })
  doc.transact(() => {
    ;(map.get("nested") as Y.Map<number>).set("value", 2)
    ;(map.get("array") as Y.Array<number>).delete(0, 1)
    applyJsonObjectToYMap(map, snapshot, { mode: "merge" })
  })
  expect(map.toJSON()).toEqual(snapshot)
  snapshot.nested.value = 3
  applyJsonObjectToYMap(map, snapshot, { mode: "merge" })
  expect(map.toJSON()).toEqual(snapshot)
})

test.each(["map", "array"])(
  "merge converts special snapshots over existing maps in a %s",
  (kind) => {
    const doc = new Y.Doc()
    const container = kind === "map" ? doc.getMap("map") : doc.getArray("array")
    const merge = (value: any) =>
      kind === "map"
        ? applyJsonObjectToYMap(container as Y.Map<any>, { value }, { mode: "merge" })
        : applyJsonArrayToYArray(container as Y.Array<any>, [value], { mode: "merge" })
    const get = () =>
      kind === "map" ? (container as Y.Map<any>).get("value") : (container as Y.Array<any>).get(0)
    merge({ ordinary: true })
    merge(getSnapshot(YjsTextModel.withText("hello")))
    expect(get()).toBeInstanceOf(Y.Text)
    expect(get().toString()).toBe("hello")
    merge({ ordinary: true })
    merge(getSnapshot(frozen({ immutable: true })))
    expect(get()).not.toBeInstanceOf(Y.Map)
    expect(get()).toEqual({ $frozen: true, data: { immutable: true } })
  }
)

@testModel("synchronization-item")
class Item extends Model({ id: idProp, value: tProp(0) }) {}

test("reconciled models receive the replacement snapshot", () => {
  const doc = new Y.Doc()
  const array = doc.getArray("items")
  array.push([convertJsonToYjsData(getSnapshot(new Item({ id: "item", value: 1 })))])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(Item),
  })
  autoDispose(dispose)
  const item = boundObject[0]
  doc.transact(() => {
    array.delete(0, 1)
    array.insert(0, [convertJsonToYjsData({ ...getSnapshot(item), value: 2 })])
  })
  expect(boundObject[0]).toBe(item)
  expect(item.value).toBe(2)
})

test("binding rejects an object from a different document", () => {
  const doc = new Y.Doc()
  const otherDoc = new Y.Doc()
  expect(() =>
    bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: otherDoc.getText(),
      mobxKeystoneType: YjsTextModel,
    })
  ).toThrow()
})

@testModel("synchronization-text-parent")
class TextParent extends Model({
  count: tProp(0),
  text: tProp(types.maybe(YjsTextModel)),
}) {}

test("a text inserted and edited in one action is synchronized once", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: TextParent,
  })
  autoDispose(dispose)
  runUnprotected(() => {
    boundObject.text = YjsTextModel.withText("abc")
    boundObject.text.deltaList.push(frozen([{ retain: 3 }, { insert: "d" }]))
  })
  expect((map.get("text") as Y.Text).toString()).toBe("abcd")
})

test("a text replacement from Yjs can be edited locally without feedback", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: TextParent,
  })
  autoDispose(dispose)
  const text = new Y.Text("abc")
  map.set("text", text)
  text.insert(3, "d")
  expect(boundObject.text!.text).toBe("abcd")
  expect(boundObject.text!.deltaList.length).toBe(2)
  runUnprotected(() => boundObject.text!.deltaList.push(frozen([{ retain: 4 }, { insert: "!" }])))
  expect(text.toString()).toBe("abcd!")
})

test("binding defaults preserves an existing Y.Text and its relative positions", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const text = new Y.Text("abc")
  map.set("text", text)
  const position = Y.createRelativePositionFromTypeIndex(text, 1)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: TextParent,
  })
  autoDispose(dispose)
  expect(map.get("text")).toBe(text)
  expect(boundObject.text!.yjsText).toBe(text)
  expect(Y.createAbsolutePositionFromRelativePosition(position, doc)?.index).toBe(1)
})

test("replacing text history with equivalent deltas preserves Yjs positions", () => {
  const { doc, text, boundObject } = bindText()
  text.insert(3, "d")
  const position = Y.createRelativePositionFromTypeIndex(text, 1)
  const update = vi.fn()
  doc.on("update", update)
  runUnprotected(() => {
    boundObject.deltaList = [frozen([{ insert: "abcd" }])]
  })
  expect(text.toString()).toBe("abcd")
  expect(boundObject.deltaList).toHaveLength(1)
  expect(Y.createAbsolutePositionFromRelativePosition(position, doc)?.index).toBe(1)
  expect(update).not.toHaveBeenCalled()
})

test("text history replacement compares formatting as well as characters", () => {
  const { doc, text, boundObject } = bindText()
  text.format(0, 3, { bold: true })
  const position = Y.createRelativePositionFromTypeIndex(text, 1)
  const update = vi.fn()
  doc.on("update", update)
  runUnprotected(() => {
    boundObject.deltaList = [frozen([{ insert: "abc", attributes: { bold: true } }])]
  })
  expect(update).not.toHaveBeenCalled()
  expect(Y.createAbsolutePositionFromRelativePosition(position, doc)?.index).toBe(1)
  runUnprotected(() => {
    boundObject.deltaList = [frozen([{ insert: "abc", attributes: { italic: true } }])]
  })
  expect(text.toDelta()).toEqual([{ insert: "abc", attributes: { italic: true } }])
  expect(update).toHaveBeenCalledTimes(1)
})

test("consecutive text history replacements replay only the final history", () => {
  const { doc, text, boundObject, yjsOrigin } = bindText()
  const undo = new Y.UndoManager(text, { trackedOrigins: new Set([yjsOrigin]) })
  autoDispose(() => undo.destroy())
  const apply = vi.spyOn(text, "applyDelta")
  try {
    runUnprotected(() => {
      boundObject.deltaList = [frozen([{ insert: "intermediate" }])]
      boundObject.deltaList = [frozen([{ insert: "final" }])]
    })
    expect(text.toString()).toBe("final")
    expect(apply).toHaveBeenCalledTimes(1)
  } finally {
    apply.mockRestore()
  }
  undo.undo()
  expect(text.toString()).toBe("abc")
  undo.redo()
  expect(text.toString()).toBe("final")
  expect(boundObject.text).toBe("final")
  expect(doc.getText("text")).toBe(text)
})

test.each(["append", "replace"])("a reverted text %s preserves native positions", (edit) => {
  const { doc, text, boundObject } = bindText()
  const position = Y.createRelativePositionFromTypeIndex(text, 1)
  const update = vi.fn()
  doc.on("update", update)
  runUnprotected(() => {
    if (edit === "append") {
      boundObject.deltaList.push(frozen([{ retain: 3 }, { insert: "!" }]))
    } else {
      boundObject.deltaList = [frozen([{ insert: "temporary" }])]
    }
    boundObject.deltaList = [frozen([{ insert: "abc" }])]
  })
  expect(text.toString()).toBe("abc")
  expect(Y.createAbsolutePositionFromRelativePosition(position, doc)?.index).toBe(1)
  expect(update).not.toHaveBeenCalled()
})

test.each(["map", "array"])("merging a detached %s fails before changing its contents", (kind) => {
  const container = convertJsonToYjsData(kind === "map" ? { original: 1 } : [1, 2])
  expect(() => {
    if (container instanceof Y.Map) {
      applyJsonObjectToYMap(container, { replacement: 2 }, { mode: "merge" })
    } else {
      applyJsonArrayToYArray(container as Y.Array<unknown>, [3], { mode: "merge" })
    }
  }).toThrow("must be attached to a document")
  const doc = new Y.Doc()
  doc.getMap("root").set("value", container)
  expect((container as Y.Map<unknown> | Y.Array<unknown>).toJSON()).toEqual(
    kind === "map" ? { original: 1 } : [1, 2]
  )
})
