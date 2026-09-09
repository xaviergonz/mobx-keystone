import { LoroDoc, LoroMap, LoroText } from "loro-crdt"
import { autorun } from "mobx"
import {
  getSnapshot,
  idProp,
  Model,
  onDeepChange,
  prop,
  runUnprotected,
  toFrozenSnapshot,
  types,
} from "mobx-keystone"
import {
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  bindLoroToMobxKeystone,
  LoroTextModel,
  loroBindingContext,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test("nested binding follows its container when its parent list moves", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("list")
  const first = list.pushContainer(new LoroMap())
  first.set("value", 1)
  const second = list.pushContainer(new LoroMap())
  second.set("value", 2)
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: first,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)

  list.move(0, 1)
  first.set("value", 3)
  second.set("value", 4)
  doc.commit()
  expect(boundObject.value).toBe(3)

  runUnprotected(() => {
    boundObject.value = 5
  })
  expect(first.get("value")).toBe(5)
  expect(second.get("value")).toBe(4)
})

test("deleted nested binding ignores a replacement at the same path", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const nested = root.setContainer("nested", new LoroMap())
  nested.set("value", 1)
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: nested,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  const replacement = root.setContainer("nested", new LoroMap())
  replacement.set("value", 2)
  doc.commit()
  expect(boundObject.value).toBe(1)
})

test("currentDelta reacts to committed Loro changes and setDelta", () => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  const observed: unknown[] = []
  autoDispose(
    autorun(() => {
      observed.push(boundObject.currentDelta)
    })
  )
  text.insert(0, "remote")
  doc.commit()
  expect(observed.at(-1)).toEqual([{ insert: "remote" }])
  boundObject.setDelta([{ insert: "local" }])
  expect(observed.at(-1)).toEqual([{ insert: "local" }])
})

test("text editing methods synchronize when mixed with model changes", () => {
  @testModel("mixed-text-edits")
  class Document extends Model({ text: prop<LoroTextModel>(), count: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const text = root.setContainer("text", new LoroText())
  text.insert(0, "abc")
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: Document,
  })
  autoDispose(dispose)
  runUnprotected(() => {
    boundObject.text.insertText(3, "d")
    boundObject.count++
  })
  expect(boundObject.text.text).toBe("abcd")
  expect(boundObject.text.currentDelta).toEqual([{ insert: "abcd" }])
  boundObject.text.deleteText(0, 1)
  expect(boundObject.text.text).toBe("bcd")
})

test.each([false, true])(
  "merge reapplies the same source after destination edits (list: %s)",
  (asList) => {
    const doc = new LoroDoc()
    const nested = { value: 1 }
    if (asList) {
      const dest = doc.getMovableList("list")
      const source = [nested]
      applyJsonArrayToLoroMovableList(dest, source, { mode: "merge" })
      ;(dest.get(0) as LoroMap).set("value", 2)
      applyJsonArrayToLoroMovableList(dest, source, { mode: "merge" })
      expect(dest.toJSON()).toEqual(source)
      nested.value = 3
      applyJsonArrayToLoroMovableList(dest, source, { mode: "merge" })
      expect(dest.toJSON()).toEqual(source)
    } else {
      const dest = doc.getMap("map")
      const source = { nested }
      applyJsonObjectToLoroMap(dest, source, { mode: "merge" })
      ;(dest.get("nested") as LoroMap).set("value", 2)
      applyJsonObjectToLoroMap(dest, source, { mode: "merge" })
      expect(dest.toJSON()).toEqual(source)
      nested.value = 3
      applyJsonObjectToLoroMap(dest, source, { mode: "merge" })
      expect(dest.toJSON()).toEqual(source)
    }
  }
)

test.each([false, true])(
  "merge replaces ordinary maps with frozen values and text (list: %s)",
  (asList) => {
    const doc = new LoroDoc()
    const values = [
      toFrozenSnapshot({ value: 1 }),
      {
        $modelType: "mobx-keystone-loro/LoroTextModel",
        deltaList: toFrozenSnapshot([{ insert: "hello" }]),
      },
    ]
    if (asList) {
      const dest = doc.getMovableList("list")
      applyJsonArrayToLoroMovableList(dest, [{ old: 1 }, { old: 2 }])
      applyJsonArrayToLoroMovableList(dest, values, { mode: "merge" })
      expect(dest.get(0)).toEqual(values[0])
      expect(dest.get(1)).toBeInstanceOf(LoroText)
    } else {
      const dest = doc.getMap("map")
      applyJsonObjectToLoroMap(dest, { frozen: { old: 1 }, text: { old: 2 } })
      applyJsonObjectToLoroMap(dest, { frozen: values[0], text: values[1] }, { mode: "merge" })
      expect(dest.get("frozen")).toEqual(values[0])
      expect(dest.get("text")).toBeInstanceOf(LoroText)
    }
  }
)

test("disposing a binding detaches text editing methods from the document", () => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  text.insert(0, "hello")
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  dispose()
  expect(boundObject.loroText).toBeUndefined()
  boundObject.insertText(5, "!")
  expect(boundObject.text).toBe("hello!")
  expect(text.toString()).toBe("hello")
})

test("binding context exposes the live Loro synchronization flag", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  const context = loroBindingContext.get(boundObject)!
  const flags: boolean[] = []
  autoDispose(
    onDeepChange(boundObject, () => {
      flags.push(context.isApplyingLoroChangesToMobxKeystone)
    })
  )
  root.set("value", 1)
  doc.commit()
  runUnprotected(() => {
    boundObject.value = 2
  })
  expect(flags).toEqual([true, false])
  expect(context.isApplyingLoroChangesToMobxKeystone).toBe(false)
})

test("replacing a model with a different type and the same ID", () => {
  @testModel("replacement-type-a")
  class A extends Model({ id: idProp, value: prop(0) }) {}
  @testModel("replacement-type-b")
  class B extends Model({ id: idProp, value: prop(0) }) {}
  const doc = new LoroDoc()
  const list = doc.getMovableList("list")
  applyJsonArrayToLoroMovableList(list, [getSnapshot(new A({ id: "same" }))])
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.or(A, B)),
  })
  autoDispose(dispose)
  list.delete(0, 1)
  applyJsonArrayToLoroMovableList(list, [getSnapshot(new B({ id: "same", value: 2 }))])
  doc.commit()
  expect(boundObject[0]).toBeInstanceOf(B)
  expect(boundObject[0].value).toBe(2)
})

test("binding defaults preserve existing rich text containers", () => {
  @testModel("default-with-existing-text")
  class Document extends Model({ text: prop<LoroTextModel>(), count: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const text = root.setContainer("text", new LoroText())
  text.insert(0, "hello")
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: Document,
  })
  autoDispose(dispose)
  expect(boundObject.text.text).toBe("hello")
  expect((root.get("text") as LoroText).id).toBe(text.id)
})

test("text methods honor earlier model edits in the same action", () => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  runUnprotected(() => {
    boundObject.setDelta([{ insert: "abc" }])
    boundObject.insertText(3, "d")
    boundObject.deleteText(0, 1)
  })
  expect(boundObject.text).toBe("bcd")
  expect(text.toString()).toBe("bcd")
})
