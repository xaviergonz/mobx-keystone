import { LoroDoc, type LoroText } from "loro-crdt"
import { getSnapshot } from "mobx-keystone"
import { bindLoroToMobxKeystone, convertJsonToLoroData, LoroTextModel } from "../../src"
import { convertLoroDataToJson } from "../../src/binding/convertLoroDataToJson"
import type { PlainValue } from "../../src/plainTypes"
import { autoDispose } from "../utils"

test("converting an empty formatted span skips its empty mark range", () => {
  const model = LoroTextModel.withDelta([
    { insert: "", attributes: { bold: true } },
    { insert: "hello" },
  ])
  const text = convertJsonToLoroData(getSnapshot(model) as unknown as PlainValue) as LoroText
  expect(text.toDelta()).toEqual([{ insert: "hello" }])
})

test("setting an empty formatted span on bound text preserves the following text", () => {
  const doc = new LoroDoc()
  doc.configTextStyle({ bold: { expand: "after" } })
  const text = doc.getText("text")
  text.insert(0, "old")
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  boundObject.setDelta([{ insert: "", attributes: { bold: true } }, { insert: "new" }])
  expect(text.toDelta()).toEqual([{ insert: "new" }])
})

test("unbound text editing ignores empty formatted spans", () => {
  const model = LoroTextModel.withDelta([
    { insert: "a" },
    { insert: "", attributes: { bold: true } },
    { insert: "b" },
  ])
  model.insertText(1, "!")
  expect(model.currentDelta).toEqual([{ insert: "a!b" }])
  model.deleteText(1, 1)
  expect(model.currentDelta).toEqual([{ insert: "ab" }])
})

test("empty text produces no delta span, matching what Loro stores", () => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  expect(LoroTextModel.withText("").currentDelta).toEqual([])
  boundObject.setDelta(LoroTextModel.withText("").currentDelta)
  expect(getSnapshot(boundObject)).toEqual(convertLoroDataToJson(text))
})
