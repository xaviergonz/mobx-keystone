import { Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, YjsTextModel } from "../../src"
import { isYjsValueDeleted } from "../../src/utils/isYjsValueDeleted"
import { autoDispose, testModel } from "../utils"

@testModel("yjs-test-submodel")
class SubModel extends Model({
  primitive: tProp(types.number, 0),
}) {}

@testModel("yjs-test-model")
class TestModel extends Model({
  submodel: tProp(types.maybe(SubModel)),
  submodel2: tProp(types.maybe(SubModel)),
  simpleArray: tProp(types.array(types.number), () => []),
  simpleRecord: tProp(types.record(types.number), () => ({})),
  text: tProp(types.maybe(YjsTextModel)),
}) {}

test("data is still readable after detaching", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: TestModel,
  })
  autoDispose(() => {
    dispose()
  })

  runUnprotected(() => {
    boundObject.submodel = new SubModel({ primitive: 1 })
    boundObject.simpleArray.push(1)
    boundObject.simpleRecord.a = 1
    boundObject.text = YjsTextModel.withText("hello")
  })

  const submodel = boundObject.submodel!
  const simpleArray = boundObject.simpleArray
  const simpleRecord = boundObject.simpleRecord
  const text = boundObject.text!

  expect(submodel.primitive).toBe(1)
  expect(simpleArray[0]).toBe(1)
  expect(simpleRecord.a).toBe(1)
  expect(text.text).toBe("hello")

  runUnprotected(() => {
    boundObject.submodel = undefined
    boundObject.simpleArray = []
    boundObject.simpleRecord = {}
    boundObject.text = undefined
  })

  // they are now detached
  expect(submodel.primitive).toBe(1)
  expect(simpleArray.length).toBe(1)
  expect(simpleArray[0]).toBe(1)
  expect(simpleRecord.a).toBe(1)
  expect(text.text).toBe("hello")

  expect(submodel.$.primitive).toBe(1)
  expect(simpleArray[0]).toBe(1)
  expect(simpleRecord.a).toBe(1)
  expect(text.deltaList[0].data).toEqual([{ insert: "hello" }])
})

test("data is readable from a model that was never attached", () => {
  const submodel = new SubModel({ primitive: 1 })
  const simpleArray = [1]
  const simpleRecord = { a: 1 }
  const text = YjsTextModel.withText("hello")

  expect(submodel.primitive).toBe(1)
  expect(simpleArray[0]).toBe(1)
  expect(simpleRecord.a).toBe(1)
  expect(text.text).toBe("hello")
})

test("YjsTextModel bound to a Y.Text that gets detached", () => {
  const doc = new Y.Doc()
  const yMap = doc.getMap("map")
  const yText = new Y.Text()
  yMap.set("text", yText)
  yText.insert(0, "hello")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yText,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(() => {
    dispose()
  })

  expect(boundObject.text).toBe("hello")

  // Detach yText from the doc
  yMap.delete("text")

  // Now yText.toString() is ""
  expect(yText.toString()).toBe("")

  // But boundObject.text should still be "hello"
  expect(boundObject.text).toBe("hello")
})

test("binding to a nested Yjs object that gets detached", () => {
  const doc = new Y.Doc()
  const yMap = doc.getMap("map")
  const ySubMap = new Y.Map()
  yMap.set("sub", ySubMap)

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: ySubMap,
    mobxKeystoneType: SubModel,
  })
  autoDispose(() => {
    dispose()
  })

  runUnprotected(() => {
    boundObject.primitive = 1
  })
  expect(ySubMap.get("primitive")).toBe(1)

  // Detach ySubMap from the doc
  yMap.delete("sub")

  // Now ySubMap is detached.
  // Does boundObject still work?
  expect(boundObject.primitive).toBe(1)

  runUnprotected(() => {
    boundObject.primitive = 2
  })
  expect(boundObject.primitive).toBe(2)

  // Yjs ignores the update because it's detached
  expect(ySubMap.get("primitive")).toBeUndefined()
})

test("moving a bound object", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: TestModel,
  })
  autoDispose(() => {
    dispose()
  })

  runUnprotected(() => {
    boundObject.submodel = new SubModel({ primitive: 1 })
  })

  const submodel = boundObject.submodel!
  expect(submodel.primitive).toBe(1)

  const oldSubmodelYjs = yTestModel.get("submodel") as Y.Map<any>
  expect(oldSubmodelYjs).toBeDefined()

  runUnprotected(() => {
    const sm = boundObject.submodel
    boundObject.submodel = undefined
    boundObject.submodel2 = sm
  })

  expect(boundObject.submodel2).toBe(submodel)
  expect(boundObject.submodel).toBeUndefined()

  const newSubmodelYjs = yTestModel.get("submodel2") as Y.Map<any>
  expect(newSubmodelYjs).toBeDefined()
  expect(newSubmodelYjs).not.toBe(oldSubmodelYjs)
  expect(newSubmodelYjs.get("primitive")).toBe(1)

  // old one should be deleted
  expect(yTestModel.get("submodel")).toBeUndefined()
  expect(isYjsValueDeleted(oldSubmodelYjs)).toBe(true)

  // modifying the moved object should update the new Yjs object
  runUnprotected(() => {
    submodel.primitive = 2
  })
  expect(newSubmodelYjs.get("primitive")).toBe(2)
})

test("binding to a Yjs object that gets deleted from Yjs side", () => {
  const doc = new Y.Doc()
  const yMap = doc.getMap("map")
  const ySubMap = new Y.Map()
  yMap.set("sub", ySubMap)

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: ySubMap,
    mobxKeystoneType: SubModel,
  })
  autoDispose(() => {
    dispose()
  })

  expect(boundObject.primitive).toBe(0)

  // Delete from Yjs side
  yMap.delete("sub")

  // The binding is still active.
  // If we modify boundObject, it will try to update ySubMap.
  runUnprotected(() => {
    boundObject.primitive = 1
  })
  expect(boundObject.primitive).toBe(1)

  // ySubMap is dead, so it shouldn't have the update (or it might, but it's detached)
  expect(ySubMap.get("primitive")).toBeUndefined()
})

test("binding is disposed when Yjs doc is destroyed", () => {
  const doc = new Y.Doc()
  const yMap = doc.getMap("map")

  const { boundObject } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yMap,
    mobxKeystoneType: SubModel,
  })

  // actually let's just check if it stops syncing

  runUnprotected(() => {
    boundObject.primitive = 1
  })
  expect(yMap.get("primitive")).toBe(1)

  doc.destroy()

  runUnprotected(() => {
    boundObject.primitive = 2
  })
  // should not throw, but also should not sync (obviously, doc is destroyed)
  expect(boundObject.primitive).toBe(2)
})

test("binding to a dead Yjs object", () => {
  const doc = new Y.Doc()
  const yMap = doc.getMap("map")
  const ySubMap = new Y.Map()
  yMap.set("sub", ySubMap)
  ySubMap.set("primitive", 1)

  yMap.delete("sub")
  // ySubMap is now dead

  expect(() => {
    bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: ySubMap,
      mobxKeystoneType: SubModel,
    })
  }).toThrow("cannot apply patch to deleted Yjs value")
})
