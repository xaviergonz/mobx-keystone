import { spy } from "mobx"
import { frozen, getSnapshot, idProp, Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import {
  applyJsonArrayToYArray,
  applyJsonObjectToYMap,
  bindYjsToMobxKeystone,
  convertJsonToYjsData,
  YjsTextModel,
} from "../../src"
import type { PlainValue } from "../../src/plainTypes"
import { autoDispose, testModel } from "../utils"

@testModel("incremental-item")
class Item extends Model({ id: idProp, value: tProp(0) }) {}

test.each([false, true])(
  "bulk native insertions avoid per-value conversion actions (structural: %s)",
  (structural) => {
    const doc = new Y.Doc()
    const array = doc.getArray("root")
    if (structural) {
      array.push([convertJsonToYjsData(getSnapshot(new Item({ id: "removed" })))])
    }
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: array,
      mobxKeystoneType: types.array(types.or(types.number, Item)),
    })
    autoDispose(dispose)
    let conversionActions = 0
    const stop = spy((event) => {
      if (event.type === "action" && event.name === "convertYjsDataToJsonInternal") {
        conversionActions++
      }
    })
    const values = Array.from({ length: 1000 }, (_, i) => i)
    try {
      doc.transact(() => {
        if (structural) array.delete(0, 1)
        array.push(values)
      })
    } finally {
      stop()
    }
    expect(boundObject.slice()).toEqual(values)
    expect(conversionActions).toBeLessThanOrEqual(1)
  }
)

test("reading live empty text does not replay its delta history", () => {
  const doc = new Y.Doc()
  const text = doc.getText("root")
  text.insert(0, "abc")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: text,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(dispose)
  text.delete(0, text.length)
  expect(boundObject.deltaList).toHaveLength(2)
  const applyDelta = vi.spyOn(Y.Text.prototype, "applyDelta")
  try {
    expect(boundObject.text).toBe("")
    expect(boundObject.text).toBe("")
    expect(applyDelta).not.toHaveBeenCalled()
  } finally {
    applyDelta.mockRestore()
  }
})

test.each(["detached read", "merge comparison"])(
  "%s replays text history in one transaction",
  (mode) => {
    const model = new YjsTextModel({
      deltaList: Array.from({ length: 1000 }, () => frozen([{ insert: "a" }])),
    })
    const map = new Y.Doc().getMap("root")
    const snapshot = { text: getSnapshot(model) } as unknown as Parameters<
      typeof applyJsonObjectToYMap
    >[1]
    applyJsonObjectToYMap(map, snapshot)
    const transactions = vi.fn()
    const getText = Y.Doc.prototype.getText
    const read = vi.spyOn(Y.Doc.prototype, "getText").mockImplementation(function (
      this: Y.Doc,
      name
    ) {
      this.on("afterTransaction", transactions)
      return getText.call(this, name)
    })
    try {
      if (mode === "detached read") {
        expect(model.text).toBe("a".repeat(1000))
      } else {
        const text = map.get("text") as Y.Text
        applyJsonObjectToYMap(map, snapshot, { mode: "merge" })
        expect(map.get("text")).toBe(text)
        expect(text.toString()).toBe("a".repeat(1000))
      }
      expect(transactions).toHaveBeenCalledTimes(1)
    } finally {
      read.mockRestore()
    }
  }
)

test("outgoing text edits do not compute incoming event deltas", () => {
  const doc = new Y.Doc()
  const text = doc.getText("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: text,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(dispose)
  const deltas = vi.spyOn(Y.YTextEvent.prototype, "delta", "get")
  try {
    runUnprotected(() => {
      boundObject.deltaList.push(frozen([{ insert: "hello" }]))
    })
    expect(text.toString()).toBe("hello")
    expect(deltas).not.toHaveBeenCalled()
  } finally {
    deltas.mockRestore()
  }
})

test.each(["map", "array"] as const)(
  "merging changed text edits the existing Y.Text in a %s instead of replacing it",
  (kind) => {
    const doc = new Y.Doc()
    const text = new Y.Text()
    text.insert(0, "hello")
    const changed = getSnapshot(YjsTextModel.withText("hello world"))

    if (kind === "map") {
      const map = doc.getMap<unknown>("root")
      map.set("text", text)
      applyJsonObjectToYMap(map, { text: changed } as never, { mode: "merge" })
      expect(map.get("text")).toBe(text)
    } else {
      const array = doc.getArray<unknown>("root")
      array.insert(0, [text])
      applyJsonArrayToYArray(array, [changed] as never, { mode: "merge" })
      expect(array.get(0)).toBe(text)
    }

    // Replacing the container would orphan it, leaving observers and any other
    // reference to it pointing at empty, detached text.
    expect(text.toString()).toBe("hello world")
    expect(text.doc).toBe(doc)
  }
)

test("a bound model keeps its Y.Text across a reconciling merge", () => {
  @testModel("text-identity-root")
  class Root extends Model({
    flag: tProp(0),
    text: tProp(YjsTextModel, () => YjsTextModel.withText("hi")),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const yjsText = binding.boundObject.text.yjsText

  runUnprotected(() => {
    binding.boundObject.text.deltaList.push(frozen([{ retain: 2 }, { insert: " there" }]))
  })

  expect(binding.boundObject.text.yjsText).toBe(yjsText)
  expect(yjsText.toString()).toBe("hi there")
  expect(binding.boundObject.text.text).toBe("hi there")
})

const delta = [{ insert: "", attributes: { bold: true } }, { insert: "hello" }]

test("empty formatted spans survive detached text history replay and conversion", () => {
  const model = new YjsTextModel({ deltaList: [frozen(delta)] })
  expect(model.text).toBe("hello")
  const doc = new Y.Doc()
  autoDispose(() => doc.destroy())
  const text = convertJsonToYjsData(getSnapshot(model) as unknown as PlainValue) as Y.Text
  doc.getMap("root").set("text", text)
  expect(text.toDelta()).toEqual([{ insert: "hello" }])
})

test("equivalent history with empty formatted spans avoids native text writes", () => {
  const doc = new Y.Doc()
  const text = doc.getText("root")
  text.insert(0, "hello")
  const binding = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: text,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(binding.dispose)
  const update = vi.fn()
  doc.on("update", update)
  autoDispose(() => doc.off("update", update))
  runUnprotected(() => {
    binding.boundObject.deltaList = [frozen(delta)]
  })
  expect(text.toDelta()).toEqual([{ insert: "hello" }])
  expect(binding.boundObject.text).toBe("hello")
  expect(update).not.toHaveBeenCalled()
})
