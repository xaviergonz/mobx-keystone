import { LoroDoc, LoroMap, LoroText } from "loro-crdt"
import { Model, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("loro-detached-test-submodel")
class SubModel extends Model({
  primitive: tProp(types.number, 0),
}) {}

@testModel("loro-detached-test-model")
class TestModel extends Model({
  submodel: tProp(types.maybe(SubModel)),
  simpleArray: tProp(types.array(types.number), () => []),
  text: tProp(types.maybe(LoroTextModel)),
}) {}

test("data is still readable after detaching", () => {
  const doc = new LoroDoc()
  const loroObject = doc.getMap("testModel")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject,
    mobxKeystoneType: TestModel,
  })
  autoDispose(dispose)

  runUnprotected(() => {
    boundObject.submodel = new SubModel({ primitive: 1 })
    boundObject.simpleArray.push(1)
    boundObject.text = LoroTextModel.withText("hello")
  })

  const { submodel, simpleArray, text } = boundObject
  const submodelVal = submodel!
  const textVal = text!

  const expectData = () => {
    expect(submodelVal.primitive).toBe(1)
    expect(simpleArray[0]).toBe(1)
    expect(textVal.text).toBe("hello")
  }

  expectData()

  runUnprotected(() => {
    boundObject.submodel = undefined
    boundObject.simpleArray = []
    boundObject.text = undefined
  })

  // they are now detached - in Loro, detached containers are still readable
  expectData()
})

test("LoroTextModel bound to a LoroText that gets detached", () => {
  const doc = new LoroDoc()
  const loroMap = doc.getMap("map")
  const loroText = loroMap.setContainer("text", new LoroText())
  loroText.insert(0, "hello")
  doc.commit()

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroText,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)

  expect(boundObject.text).toBe("hello")

  // Detach loroText from the map
  loroMap.delete("text")
  doc.commit()

  // In Loro, detached containers remain readable
  expect(boundObject.text).toBe("hello")
})

test("binding to a nested Loro object that gets detached/deleted", () => {
  const doc = new LoroDoc()
  const loroMap = doc.getMap("map")
  const loroSubMap = loroMap.setContainer("sub", new LoroMap())
  doc.commit()

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroSubMap,
    mobxKeystoneType: SubModel,
  })
  autoDispose(dispose)

  runUnprotected(() => {
    boundObject.primitive = 1
  })
  expect(loroSubMap.get("primitive")).toBe(1)

  // Detach/Delete loroSubMap from the map
  loroMap.delete("sub")
  doc.commit()

  // In Loro, detached containers remain readable
  expect(boundObject.primitive).toBe(1)
  expect(loroSubMap.get("primitive")).toBe(1)
})
