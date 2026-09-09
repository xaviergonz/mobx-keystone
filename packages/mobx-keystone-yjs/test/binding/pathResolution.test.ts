import { autorun, runInAction } from "mobx"
import { getSnapshot, Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, convertJsonToYjsData, YjsTextModel } from "../../src"
import { resolveYjsPath } from "../../src/binding/resolveYjsPath"
import { getYjsCollectionAtom } from "../../src/utils/yjsCollectionAtoms"
import { autoDispose, testModel } from "../utils"

@testModel("path-default-item")
class Item extends Model({ value: tProp(types.number, 5) }) {}

test("default restoration resolves a model after its array index changes", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<Y.Map<unknown>>("root")
  const item = convertJsonToYjsData(getSnapshot(new Item({ value: 10 }))) as Y.Map<unknown>
  array.push([item])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(Item),
  })
  autoDispose(dispose)
  doc.transact(() => {
    array.insert(0, [convertJsonToYjsData(getSnapshot(new Item({ value: 20 }))) as Y.Map<unknown>])
    item.delete("value")
  })
  expect(boundObject.map((value) => value.value)).toEqual([20, 5])
  expect(item.get("value")).toBe(5)
})

@testModel("text-path-root")
class TextRoot extends Model({
  count: tProp(0),
  texts: tProp(types.record(YjsTextModel), () => ({})),
}) {}

test.each(["model", "yjs"])("%s scalar edits do not re-resolve unrelated text paths", (source) => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: TextRoot,
  })
  runUnprotected(() => {
    for (let i = 0; i < 50; i++) boundObject.texts[String(i)] = YjsTextModel.withText(String(i))
  })
  autoDispose(
    autorun(() => {
      for (const text of Object.values(boundObject.texts)) void text.yjsText
    })
  )
  autoDispose(dispose)
  const reads = vi.spyOn(map, "get")
  autoDispose(() => reads.mockRestore())
  if (source === "model")
    runUnprotected(() => {
      boundObject.count++
    })
  else map.set("count", 1)
  expect(boundObject.count).toBe(1)
  expect(reads.mock.calls.filter(([key]) => key === "texts")).toHaveLength(0)
})

test("replacing a map entry invalidates the corresponding text path", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: TextRoot,
  })
  runUnprotected(() => {
    boundObject.texts.a = YjsTextModel.withText("old")
  })
  const observed: Y.Text[] = []
  autoDispose(
    autorun(() => {
      observed.push(boundObject.texts.a.yjsText)
    })
  )
  autoDispose(dispose)
  const replacement = new Y.Text("new")
  runInAction(() => (map.get("texts") as Y.Map<Y.Text>).set("a", replacement))
  expect(observed.at(-1)).toBe(replacement)
  expect(boundObject.texts.a.text).toBe("new")
})

test("untracked path reads do not retain map-key atoms", () => {
  const map = new Y.Doc().getMap("root")
  map.set("value", 1)
  expect(resolveYjsPath(map, ["value"])).toBe(1)
  expect(getYjsCollectionAtom(map, "value")).toBeUndefined()
})

test("map-key atoms are released when their last observer stops", () => {
  const map = new Y.Doc().getMap("root")
  map.set("value", 1)
  const stop = autorun(() => {
    void resolveYjsPath(map, ["value"])
  })
  expect(getYjsCollectionAtom(map, "value")).toBeDefined()
  stop()
  expect(getYjsCollectionAtom(map, "value")).toBeUndefined()
})

test("net-zero native array edits do not invalidate retained text paths", () => {
  const doc = new Y.Doc()
  const array = doc.getArray("root")
  array.push(Array.from({ length: 50 }, (_, i) => new Y.Text(String(i))))
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(YjsTextModel),
  })
  autoDispose(
    autorun(() => {
      for (const text of boundObject) void text.yjsText
    })
  )
  autoDispose(dispose)
  const retained = boundObject[0]
  const nativeText = array.get(0)
  const reads = vi.spyOn(array, "get")
  try {
    doc.transact(() => {
      array.insert(0, ["temporary"])
      array.delete(0, 1)
    })
    expect(boundObject).toHaveLength(50)
    expect(reads).not.toHaveBeenCalled()
    array.insert(0, [new Y.Text("new")])
    expect(boundObject[1]).toBe(retained)
    expect(boundObject[1].yjsText).toBe(nativeText)
    expect(reads).toHaveBeenCalled()
  } finally {
    reads.mockRestore()
  }
})
