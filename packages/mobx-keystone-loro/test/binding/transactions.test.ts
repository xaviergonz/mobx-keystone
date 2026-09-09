import { LoroDoc, LoroMap, type LoroMovableList } from "loro-crdt"
import { getSnapshot, Model, prop, runUnprotected, types } from "mobx-keystone"
import {
  applyJsonObjectToLoroMap,
  bindLoroToMobxKeystone,
  LoroTextModel,
  loroBindingContext,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test("unbound text edits preserve existing formatting", () => {
  const model = LoroTextModel.withDelta([
    { insert: "bold", attributes: { bold: true } },
    { insert: " plain" },
  ])
  model.insertText(10, "!")
  expect(model.currentDelta).toEqual([
    { insert: "bold", attributes: { bold: true } },
    { insert: " plain!" },
  ])
  model.deleteText(4, 6)
  expect(model.currentDelta).toEqual([
    { insert: "bold", attributes: { bold: true } },
    { insert: "!" },
  ])
})

test("remote model initialization receives the binding context", () => {
  const contexts: unknown[] = []
  @testModel("remote-context-child")
  class Child extends Model({ value: prop(0) }) {
    onInit() {
      contexts.push(loroBindingContext.get(this))
    }
  }
  const modelType = getSnapshot(new Child({})).$modelType
  contexts.length = 0
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(Child),
  })
  autoDispose(dispose)
  const remote = doc.fork()
  applyJsonObjectToLoroMap(remote.getMovableList("items").pushContainer(new LoroMap()), {
    $modelType: modelType,
    value: 42,
  })
  remote.commit()
  doc.import(remote.export({ mode: "update" }))
  expect(boundObject[0].value).toBe(42)
  expect(contexts).toEqual([loroBindingContext.get(boundObject)])
})

test("remote init array changes are applied once", () => {
  @testModel("remote-array-init")
  class Child extends Model({ values: prop<number[]>(() => []) }) {
    onInit() {
      this.values.push(2)
    }
  }
  const modelType = getSnapshot(new Child({})).$modelType
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(Child),
  })
  autoDispose(dispose)
  const remote = doc.fork()
  applyJsonObjectToLoroMap(remote.getMovableList("items").pushContainer(new LoroMap()), {
    $modelType: modelType,
    values: [1],
  })
  remote.commit()
  doc.import(remote.export({ mode: "update" }))
  expect(boundObject[0].values).toEqual([1, 2])
  expect(list.toJSON()).toEqual(getSnapshot(boundObject))
})

test("uncommitted Loro changes are not swallowed by a model commit", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  root.set("external", 1)
  runUnprotected(() => {
    boundObject.local = 2
  })
  expect(getSnapshot(boundObject)).toEqual({ external: 1, local: 2 })
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test.each(["local", "remote"])(
  "%s list changes stay synchronized across varied edits",
  (source) => {
    const doc = new LoroDoc()
    const list = doc.getMovableList("list")
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: list,
      mobxKeystoneType: types.array(types.number),
    })
    autoDispose(dispose)
    const editingDoc = source === "remote" ? doc.fork() : doc
    const editingList = editingDoc.getMovableList("list")
    let state = 12345
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state % max
    }
    for (let batch = 0; batch < 100; batch++) {
      for (let op = 0; op < 10; op++) {
        const kind = random(4)
        if (kind === 0 || editingList.length === 0)
          editingList.insert(random(editingList.length + 1), random(100))
        else if (kind === 1) editingList.delete(random(editingList.length), 1)
        else if (kind === 2)
          editingList.move(random(editingList.length), random(editingList.length))
        else editingList.set(random(editingList.length), random(100))
      }
      editingDoc.commit()
      if (source === "remote") doc.import(editingDoc.export({ mode: "update" }))
      expect(getSnapshot(boundObject)).toEqual(list.toJSON())
    }
  }
)

test("a Loro commit inside a model action preserves queued list changes", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("list")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  runUnprotected(() => {
    boundObject.push(2)
    list.push(1)
    doc.commit()
  })
  expect([...boundObject].sort()).toEqual([1, 2])
  expect(getSnapshot(boundObject)).toEqual(list.toJSON())
})

test("mixed pending Loro and model list edits are reconciled without duplicate insertions", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("list")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  list.push(1)
  runUnprotected(() => {
    boundObject.push(2)
  })
  expect([...boundObject].sort()).toEqual([1, 2])
  expect(getSnapshot(boundObject)).toEqual(list.toJSON())
})

test("replacing rich text clears old formatting and preserves Unicode", () => {
  const doc = new LoroDoc()
  doc.configTextStyle({ bold: { expand: "after" } })
  const text = doc.getText("text")
  text.insert(0, "bold")
  text.mark({ start: 0, end: 4 }, "bold", true)
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  boundObject.setDelta([{ insert: "😀" }, { insert: "hello", attributes: { bold: true } }])
  expect(text.toDelta()).toEqual(boundObject.currentDelta)
  boundObject.setDelta([{ insert: "plain" }])
  expect(text.toDelta()).toEqual([{ insert: "plain" }])
})

test("init mutations after a mixed commit are synchronized without replay", () => {
  @testModel("mixed-init")
  class Child extends Model({ values: prop<number[]>(() => []) }) {
    onInit() {
      this.values.push(2)
    }
  }
  const modelType = getSnapshot(new Child({})).$modelType
  @testModel("mixed-init-root")
  class Root extends Model({ children: prop<Child[]>(() => []), count: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const children = root.get("children") as LoroMovableList
  applyJsonObjectToLoroMap(children.pushContainer(new LoroMap()), {
    $modelType: modelType,
    values: [1],
  })
  runUnprotected(() => {
    boundObject.count++
  })
  expect(boundObject.children[0].values).toEqual([1, 2])
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test("snapshot conversion preserves an own __proto__ property", async () => {
  const { convertLoroDataToJson } = await import("../../src/binding/convertLoroDataToJson")
  const value = JSON.parse('{"__proto__":{"value":1},"normal":2}')
  const map = new LoroMap()
  applyJsonObjectToLoroMap(map, value)
  for (const input of [map, value]) {
    const converted = convertLoroDataToJson(input)
    expect(Object.hasOwn(converted as object, "__proto__")).toBe(true)
    expect(converted).toEqual(value)
    expect(Object.getPrototypeOf(converted)).toBe(Object.prototype)
  }
})

test("inserting styled text inside an unbound span preserves formatting", () => {
  const model = LoroTextModel.withDelta([{ insert: "abcd", attributes: { bold: true } }])
  model.insertText(2, "😀")
  expect(model.currentDelta).toEqual([{ insert: "ab😀cd", attributes: { bold: true } }])
  model.deleteText(2, 2)
  expect(model.currentDelta).toEqual([{ insert: "abcd", attributes: { bold: true } }])
})
