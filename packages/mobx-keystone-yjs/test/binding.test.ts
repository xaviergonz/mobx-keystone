import {
  Model,
  getSnapshot,
  model,
  modelTypeKey,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone } from "../src"
import { autoDispose } from "./utils"

@model("yjs-test-submodel")
class SubModel extends Model({
  primitive: tProp(types.number, 0),
}) {
  protected onInit(): void {
    this.primitive++
  }
}

@model("yjs-test-model")
class TestModel extends Model({
  primitive: tProp(types.number, 0),
  maybePrimitive: tProp(types.maybe(types.number)),
  simpleArray: tProp(types.array(types.number), () => []),
  simpleRecord: tProp(types.record(types.number), () => ({})),
  complexArray: tProp(types.array(types.array(types.number)), () => []),
  complexRecord: tProp(types.record(types.record(types.number)), () => ({})),
  submodel: tProp(SubModel, () => new SubModel({})),
}) {
  protected onInit(): void {
    this.simpleArray.push(1)
  }
}

test("bind a model", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: TestModel,
  })
  autoDispose(() => dispose())

  expect(boundObject).toBeDefined()

  const expectToBeInSync = () => {
    const sn = getSnapshot(boundObject)
    const yjsSn = yTestModel.toJSON()
    expect(sn).toEqual(yjsSn)
  }

  const expectNotToBeInSync = () => {
    const sn = getSnapshot(boundObject)
    const yjsSn = yTestModel.toJSON()
    expect(sn).not.toEqual(yjsSn)
  }

  expectToBeInSync()

  // mobx-keystone -> yjs
  runUnprotected(() => {
    boundObject.maybePrimitive = 2
    expectNotToBeInSync()
  })
  expectToBeInSync()

  runUnprotected(() => {
    boundObject.maybePrimitive = undefined
    expectNotToBeInSync()
  })
  expectToBeInSync()

  runUnprotected(() => {
    boundObject.primitive = 2
    expectNotToBeInSync()
    boundObject.simpleArray.push(2)
    expectNotToBeInSync()
    boundObject.simpleRecord.a = 2
    expectNotToBeInSync()
    boundObject.complexArray.push([2])
    expectNotToBeInSync()
    boundObject.complexRecord.a = { a: 2 }
    expectNotToBeInSync()
    boundObject.submodel.primitive = 2
    expectNotToBeInSync()
    boundObject.submodel = new SubModel({ primitive: 20 })
    expectNotToBeInSync()
  })
  expectToBeInSync()

  // yjs -> mobx-keystone
  yTestModel.set("maybePrimitive", 3)
  expectToBeInSync()
  yTestModel.delete("maybePrimitive")
  expectToBeInSync()

  yTestModel.set("primitive", 3)
  expectToBeInSync()
  ;(yTestModel.get("simpleArray") as Y.Array<number>).push([3])
  expectToBeInSync()
  ;(yTestModel.get("simpleRecord") as Y.Map<number>).set("b", 3)
  expectToBeInSync()

  const subArray = new Y.Array<number>()
  subArray.push([3])
  ;(yTestModel.get("complexArray") as Y.Array<Y.Array<number>>).push([subArray])
  expectToBeInSync()

  const subRecord = new Y.Map<any>()
  subRecord.set("a", 3)
  ;(yTestModel.get("complexRecord") as Y.Map<Y.Map<number>>).set("b", subRecord)
  expectToBeInSync()
  // submodel prop
  ;(yTestModel.get("submodel") as Y.Map<any>).set("primitive", 3)
  expectToBeInSync()
  // submodel instance
  const subModel = new Y.Map()
  subModel.set(modelTypeKey, "yjs-test-submodel")
  subModel.set("primitive", 30)
  yTestModel.set("submodel", subModel)
  expectToBeInSync()

  doc.transact(() => {
    yTestModel.set("primitive", 4)
    expectNotToBeInSync()
    ;(yTestModel.get("simpleArray") as Y.Array<number>).push([4])
    expectNotToBeInSync()
    ;(yTestModel.get("simpleRecord") as Y.Map<number>).set("c", 4)
    expectNotToBeInSync()

    const subArray = new Y.Array<number>()
    subArray.push([4])
    ;(yTestModel.get("complexArray") as Y.Array<Y.Array<number>>).push([subArray])
    expectNotToBeInSync()

    const subRecord = new Y.Map<any>()
    subRecord.set("a", 4)
    ;(yTestModel.get("complexRecord") as Y.Map<Y.Map<number>>).set("c", subRecord)
    expectNotToBeInSync()
    // submodel prop
    ;(yTestModel.get("submodel") as Y.Map<any>).set("primitive", 4)
    expectNotToBeInSync()
    // submodel instance
    const subModel = new Y.Map()
    subModel.set(modelTypeKey, "yjs-test-submodel")
    subModel.set("primitive", 40)
    yTestModel.set("submodel", subModel)
    expectNotToBeInSync()
  })
  expectToBeInSync()
})

test("bind a simple array", () => {
  const doc = new Y.Doc()
  const yTestArray = doc.getArray("testArray")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestArray,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(() => dispose())

  expect(boundObject).toBeDefined()

  const expectToBeInSync = () => {
    const sn = getSnapshot(boundObject)
    const yjsSn = yTestArray.toJSON()
    expect(sn).toStrictEqual(yjsSn)
  }

  const expectNotToBeInSync = () => {
    const sn = getSnapshot(boundObject)
    const yjsSn = yTestArray.toJSON()
    expect(sn).not.toStrictEqual(yjsSn)
  }

  expectToBeInSync()

  // mobx-keystone -> yjs
  runUnprotected(() => {
    boundObject.push(2)
    expectNotToBeInSync()
    boundObject.splice(0, 1, 5)
    expectNotToBeInSync()
  })
  expectToBeInSync()

  // yjs -> mobx-keystone
  yTestArray.push([1, 2, 3])
  expectToBeInSync()

  yTestArray.delete(1, 2)
  expectToBeInSync()

  yTestArray.insert(1, [4, 5])
  expectToBeInSync()

  doc.transact(() => {
    yTestArray.push([6, 7, 8])
    expectNotToBeInSync()
    yTestArray.delete(1, 2)
    expectNotToBeInSync()
    yTestArray.insert(1, [9, 10])
    expectNotToBeInSync()
  })
  expectToBeInSync()
})
