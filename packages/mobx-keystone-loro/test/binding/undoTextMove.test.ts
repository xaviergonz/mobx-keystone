import { LoroDoc, type LoroMap, type LoroText, UndoManager } from "loro-crdt"
import { frozen, getSnapshot, idProp, Model, runUnprotected, tProp, types } from "mobx-keystone"
import { applyJsonArrayToLoroMovableList, bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import type { PlainArray } from "../../src/plainTypes"
import { autoDispose, testModel } from "../utils"

test("undo and redo preserve combined text edits and model moves", () => {
  @testModel("undo-text-item")
  class Item extends Model({ id: idProp, text: tProp(LoroTextModel) }) {}
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  const initial = [
    new Item({ id: "a", text: LoroTextModel.withText("abc") }),
    new Item({ id: "b", text: LoroTextModel.withText("def") }),
  ]
  applyJsonArrayToLoroMovableList(
    list,
    initial.map((item) => getSnapshot(item)) as unknown as PlainArray
  )
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(Item),
  })
  autoDispose(dispose)
  const undo = new UndoManager(doc, { mergeInterval: 0 })
  autoDispose(() => undo.free())
  const [first, second] = boundObject
  runUnprotected(() => {
    first.text.deltaList = frozen([{ insert: "abc!" }])
    boundObject.splice(0, 1)
    boundObject.push(first)
  })
  const expectState = (ids: string[], texts: string[]) => {
    expect(boundObject.map((item) => item.id)).toEqual(ids)
    expect(boundObject.map((item) => item.text.text)).toEqual(texts)
    expect(
      list.toArray().map((item) => ((item as LoroMap).get("text") as LoroText).toString())
    ).toEqual(texts)
    expect(boundObject.find((item) => item.id === "a")).toBe(first)
    expect(boundObject.find((item) => item.id === "b")).toBe(second)
  }
  expectState(["b", "a"], ["def", "abc!"])
  expect(undo.undo()).toBe(true)
  expectState(["a", "b"], ["abc", "def"])
  expect(undo.redo()).toBe(true)
  expectState(["b", "a"], ["def", "abc!"])
})
