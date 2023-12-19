import { Model, getSnapshot, model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone } from "../src"
import { autoDispose } from "./utils"

@model("yjs-test-model")
class TestModel extends Model({
  primitive: tProp(types.number, 0),
  simpleArray: tProp(types.array(types.number), () => []),
  simpleRecord: tProp(types.record(types.number), () => ({})),
  complexArray: tProp(types.array(types.array(types.number)), () => []),
  complexRecord: tProp(types.record(types.record(types.number)), () => ({})),
}) {
  protected onInit(): void {
    this.simpleArray.push(1)
  }
}

/*
function convertYjsEventToJsonPatch(event: Y.YEvent<any>): void {
  console.log({
    changes: event.changes,
    currentTarget: event.currentTarget,
    delta: event.delta,
    keys: event.keys,
    path: event.path,
    target: event.target,
  })
}
*/

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
    expect(sn).toStrictEqual(yjsSn)
  }
  expectToBeInSync()

  // mobx-keystone -> yjs
  runUnprotected(() => {
    boundObject.primitive = 2
    boundObject.simpleArray.push(2)
    boundObject.simpleRecord.a = 2
    boundObject.complexArray.push([2])
    boundObject.complexRecord.a = { a: 2 }
  })
  expectToBeInSync()

  // yjs -> mobx-keystone
  // TODO

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
  expectToBeInSync()

  // mobx-keystone -> yjs
  runUnprotected(() => {
    boundObject.push(2)
  })
  expectToBeInSync()

  // yjs -> mobx-keystone
  // TODO

  expectToBeInSync()
})
