import { LoroDoc, LoroMap, LoroText } from "loro-crdt"
import { autorun } from "mobx"
import { getSnapshot, idProp, Model, prop, runUnprotected, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(["map", "list"])("adding formatted text to a %s uses the snapshot formatting", (kind) => {
  const doc = new LoroDoc()
  // Initial snapshot conversion supports detached marks without document style setup.
  const delta = [{ insert: "bold", attributes: { bold: true } }]
  if (kind === "map") {
    const map = doc.getMap("root")
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: map,
      mobxKeystoneType: types.record(LoroTextModel),
    })
    autoDispose(dispose)
    runUnprotected(() => {
      boundObject.text = LoroTextModel.withDelta(delta)
    })
    expect((map.get("text") as LoroText).toDelta()).toEqual(delta)
  } else {
    const list = doc.getMovableList("root")
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: list,
      mobxKeystoneType: types.array(LoroTextModel),
    })
    autoDispose(dispose)
    runUnprotected(() => {
      boundObject.push(LoroTextModel.withDelta(delta))
    })
    expect((list.get(0) as LoroText).toDelta()).toEqual(delta)
    runUnprotected(() => {
      boundObject[0] = LoroTextModel.withDelta(delta)
    })
    expect((list.get(0) as LoroText).toDelta()).toEqual(delta)
  }
})

test("cached text references follow remote container replacement", () => {
  @testModel("cached-text-child")
  class Child extends Model({ id: idProp, text: prop<LoroTextModel>() }) {}
  const modelType = getSnapshot(
    new Child({ id: "child", text: LoroTextModel.withText("hello") })
  ).$modelType
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const fillChild = (container: LoroMap) => {
    container.set("$modelType", modelType)
    container.set("id", "child")
    const text = container.setContainer("text", new LoroText())
    text.insert(0, "hello")
    return text
  }
  fillChild(root.setContainer("child", new LoroMap()))
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Child),
  })
  autoDispose(dispose)
  const textModel = boundObject.child.text
  autoDispose(
    autorun(() => {
      void textModel.loroText
    })
  )
  const remote = doc.fork()
  const replacementText = fillChild(remote.getMap("root").setContainer("child", new LoroMap()))
  remote.commit()
  doc.import(remote.export({ mode: "update" }))
  expect(boundObject.child.text).toBe(textModel)
  expect(textModel.loroText?.id).toBe(replacementText.id)
  textModel.insertText(5, "!")
  expect(textModel.text).toBe("hello!")
  expect(((root.get("child") as LoroMap).get("text") as LoroText).toString()).toBe("hello!")
})
