import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { frozen, getSnapshot, Model, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, loroBindingContext } from "../../src"
import { autoDispose, normalizeSnapshot, testModel } from "../utils"

@testModel("loro-test-submodel")
class SubModel extends Model({
  value: tProp(types.string, ""),
}) {}

@testModel("loro-test-model")
class TestModel extends Model({
  primitive: tProp(types.number, 0),
  name: tProp(types.string, ""),
  maybePrimitive: tProp(types.maybe(types.number)),
  simpleArray: tProp(types.array(types.number), () => []),
  simpleRecord: tProp(types.record(types.number), () => ({})),
  submodels: tProp(types.array(types.model(SubModel)), () => []),
  frozen: tProp(types.frozen(types.array(types.number)), () => frozen([])),
}) {
  protected override onInit(): void {
    expect(loroBindingContext.get(this)).toBeDefined()
    // not yet bound, so undefined
    expect(loroBindingContext.get(this)?.boundObject).toBe(undefined)
  }
}

test("bind a model", () => {
  const doc = new LoroDoc()
  const loroRootMap = doc.getMap("testModel")

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroRootMap,
    mobxKeystoneType: TestModel,
  })
  autoDispose(dispose)

  const expectSync = () => {
    expect(normalizeSnapshot(getSnapshot(boundObject))).toEqual(loroRootMap.toJSON())
  }

  expectSync()

  // mobx-keystone -> loro
  runUnprotected(() => {
    boundObject.maybePrimitive = 2
    boundObject.primitive = 2
    boundObject.name = "test"
    boundObject.simpleArray.push(2)
    boundObject.simpleRecord.a = 2
    boundObject.submodels.push(new SubModel({ value: "sub1" }))
    boundObject.frozen = frozen([2])
  })
  expectSync()

  runUnprotected(() => {
    boundObject.maybePrimitive = undefined
  })
  expectSync()
  expect("maybePrimitive" in loroRootMap.toJSON()).toBe(false)

  // loro -> mobx-keystone
  loroRootMap.set("maybePrimitive", 3)
  doc.commit()
  expectSync()

  loroRootMap.delete("maybePrimitive")
  doc.commit()
  expectSync()
  expect(boundObject.maybePrimitive).toBeUndefined()

  const simpleArray = loroRootMap.get("simpleArray") as LoroMovableList
  simpleArray.push(3)
  doc.commit()
  expectSync()

  // Remove item
  runUnprotected(() => {
    boundObject.simpleArray.splice(1, 1)
  })
  expectSync()
})

test("moving a bound object", () => {
  const doc = new LoroDoc()
  const loroObject = doc.getMap("testModel")

  @testModel("loro-moving-test-submodel")
  class SubModel extends Model({
    primitive: tProp(types.number, 0),
  }) {}

  @testModel("loro-moving-test-model")
  class TestModel extends Model({
    submodel: tProp(types.maybe(SubModel)),
    submodel2: tProp(types.maybe(SubModel)),
  }) {}

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject,
    mobxKeystoneType: TestModel,
  })
  autoDispose(dispose)

  runUnprotected(() => {
    boundObject.submodel = new SubModel({ primitive: 1 })
  })

  const submodel = boundObject.submodel!
  runUnprotected(() => {
    boundObject.submodel = undefined
    boundObject.submodel2 = submodel
  })

  expect(boundObject.submodel2).toBe(submodel)
  expect(boundObject.submodel).toBeUndefined()

  runUnprotected(() => {
    submodel.primitive = 2
  })
  expect(submodel.primitive).toBe(2)
})

test("binding to a simple array", () => {
  const doc = new LoroDoc()
  const loroArray = doc.getMovableList("testArray")

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroArray,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)

  const expectSync = () => expect([...boundObject]).toEqual(loroArray.toArray())

  runUnprotected(() => {
    boundObject.push(2)
  })
  expectSync()

  loroArray.push(1)
  doc.commit()
  expectSync()

  loroArray.delete(0, 1)
  doc.commit()
  expectSync()
})

test("handle undefined/null in arrays", () => {
  const doc = new LoroDoc()
  const loroRootMap = doc.getMap("testModel")

  @testModel("undefined-array-model")
  class UndefinedArrayModel extends Model({
    items: tProp(types.array(types.maybeNull(types.number)), () => []),
  }) {}

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroRootMap,
    mobxKeystoneType: UndefinedArrayModel,
  })
  autoDispose(dispose)

  runUnprotected(() => {
    boundObject.items.push(null, 1, null)
  })

  const loroList = loroRootMap.get("items") as LoroMovableList
  expect(loroList.toJSON()).toEqual([null, 1, null])
  expect(boundObject.items).toEqual([null, 1, null])
})

test("binding to a nested container works correctly", () => {
  const doc = new LoroDoc()
  const rootMap = doc.getMap("root")
  const nestedLoroMap = rootMap.setContainer("nested", new LoroMap())
  nestedLoroMap.set("value", "initial")
  doc.commit()

  @testModel("nested-model")
  class NestedModel extends Model({
    value: tProp(types.string),
  }) {}

  const { boundObject: boundNested, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: nestedLoroMap,
    mobxKeystoneType: NestedModel,
  })
  autoDispose(dispose)

  expect(boundNested.value).toBe("initial")

  // Change from Loro side
  nestedLoroMap.set("value", "updated")
  doc.commit()
  expect(boundNested.value).toBe("updated")

  // Change from MK side
  runUnprotected(() => {
    boundNested.value = "updated-from-mk"
  })
  expect(nestedLoroMap.get("value")).toBe("updated-from-mk")
})
