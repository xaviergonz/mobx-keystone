import { LoroDoc, LoroText } from "loro-crdt"
import { Model, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import { autoDispose, testModel } from "../utils"

test("bind a text as root object", () => {
  const doc = new LoroDoc()
  const loroTestText = doc.getText("testText")

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroTestText,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)

  expect(boundObject.loroText).toBe(loroTestText)

  // mobx-keystone -> loro
  runUnprotected(() => {
    boundObject.setDelta([{ insert: "abc" }])
  })
  doc.commit()
  expect(loroTestText.toDelta()).toEqual([{ insert: "abc" }])

  // loro -> mobx-keystone
  loroTestText.insert(0, "def")
  doc.commit()
  expect(boundObject.text).toBe("defabc")

  // clear
  runUnprotected(() => {
    boundObject.setDelta([])
  })
  expect(loroTestText.toDelta()).toEqual([])
})

test("load a pre-existing text", () => {
  const doc = new LoroDoc()
  const loroTestText = doc.getText("testText")
  loroTestText.insert(0, "abc")
  doc.commit()

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroTestText,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)

  expect(boundObject.text).toBe("abc")
})

@testModel("loro-test-model-with-text-model")
class TestModelWithText extends Model({
  text: tProp(types.maybe(LoroTextModel)).withSetter(),
}) {}

test("bind a text as a sub-object", () => {
  const doc = new LoroDoc()
  const loroTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroTestModel,
    mobxKeystoneType: TestModelWithText,
  })
  autoDispose(dispose)

  // starts undefined
  expect(boundObject.text).toBeUndefined()

  // set from mobx-keystone
  boundObject.setText(LoroTextModel.withText("abc"))
  expect(boundObject.text?.text).toBe("abc")
  expect(loroTestModel.get("text")).toBeInstanceOf(LoroText)

  // set from loro
  const loroText = loroTestModel.setContainer("text", new LoroText())
  loroText.insert(0, "def")
  doc.commit()
  expect(boundObject.text?.text).toBe("def")
})

test("detach/reattach same LoroTextModel", () => {
  const doc = new LoroDoc()
  const loroTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroTestModel,
    mobxKeystoneType: TestModelWithText,
  })
  autoDispose(dispose)

  boundObject.setText(LoroTextModel.withText("abc"))
  const abcText = boundObject.text!
  boundObject.setText(undefined)
  expect(boundObject.text).toBeUndefined()

  runUnprotected(() => {
    abcText.setDelta([{ insert: "modified" }])
  })
  boundObject.setText(abcText)
  expect(boundObject.text?.text).toBe("modified")
})

test("LoroTextModel standalone methods", () => {
  const text = LoroTextModel.withText("hello")
  expect(text.text).toBe("hello")
  expect(text.deltaList.data).toEqual([{ insert: "hello" }])

  runUnprotected(() => {
    text.insertText(5, " world")
  })
  expect(text.text).toBe("hello world")

  runUnprotected(() => {
    text.deleteText(5, 6)
  })
  expect(text.text).toBe("hello")
})
