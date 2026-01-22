import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import {
  frozen,
  getSnapshot,
  idProp,
  Model,
  modelTypeKey,
  prop,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import {
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  bindLoroToMobxKeystone,
  loroBindingContext,
} from "../../src"
import * as loroSnapshotTracking from "../../src/binding/loroSnapshotTracking"
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

describe("init sync during remote event handling", () => {
  // Model with onInit that mutates state
  @testModel("loro-init-sync-inner-with-onInit")
  class InnerWithOnInitModel extends Model({
    value: tProp(types.number),
    computed: tProp(types.string, ""),
  }) {
    onInit() {
      this.$.computed = `value is ${this.$.value}`
    }
  }

  // Parent model with array of inner models
  @testModel("loro-init-sync-parent")
  class ParentModel extends Model({
    items: tProp(types.array(InnerWithOnInitModel), () => []),
  }) {}

  test("init changes from remote events are synced back to Loro", () => {
    // Create doc1 with the binding
    const doc1 = new LoroDoc()
    doc1.setPeerId("1")
    const loroMap1 = doc1.getMap("testModel")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc1,
      loroObject: loroMap1,
      mobxKeystoneType: ParentModel,
    })
    autoDispose(dispose)

    // Create doc2 that will simulate a remote peer
    const doc2 = new LoroDoc()
    doc2.setPeerId("2")
    doc2.import(doc1.export({ mode: "snapshot" }))
    const loroMap2 = doc2.getMap("testModel")

    // Get the actual model type name that was registered
    const innerModelTypeName = getSnapshot(new InnerWithOnInitModel({ value: 0 }))[modelTypeKey]

    // Add an item from doc2 (simulating remote change)
    const itemsList2 = loroMap2.getOrCreateContainer("items", new LoroMovableList())
    const itemMap = itemsList2.insertContainer(0, new LoroMap())
    itemMap.set("value", 42)
    itemMap.set("$modelType", innerModelTypeName)
    doc2.commit()

    // Import the change to doc1 (this triggers the event handler)
    doc1.import(doc2.export({ mode: "update", from: doc1.version() }))

    // The model should have been created with onInit mutation applied
    expect(boundObject.items.length).toBe(1)
    expect(boundObject.items[0].value).toBe(42)
    expect(boundObject.items[0].computed).toBe("value is 42")

    // CRITICAL: The init mutation should have been synced back to Loro
    const itemsList1 = loroMap1.get("items") as LoroMovableList
    const item1 = itemsList1.get(0) as LoroMap
    expect(item1.get("computed")).toBe("value is 42")
  })
})

describe("snapshot tracking optimization", () => {
  test("merge skips unchanged containers (reference equality)", () => {
    const doc = new LoroDoc()
    const loroMap = doc.getMap("test")
    const snapshot = { a: 1, b: "hello", $modelType: "test" }

    // First merge applies values
    applyJsonObjectToLoroMap(loroMap, snapshot, { mode: "merge" })
    doc.commit()
    expect(loroMap.get("a")).toBe(1)

    // Same snapshot reference - no changes
    applyJsonObjectToLoroMap(loroMap, snapshot, { mode: "merge" })
    doc.commit()
    expect(loroMap.get("a")).toBe(1)

    // Different reference, same values - no changes due to value equality
    applyJsonObjectToLoroMap(loroMap, { a: 1, b: "hello", $modelType: "test" }, { mode: "merge" })
    doc.commit()
    expect(loroMap.get("a")).toBe(1)

    // Changed value - updates
    applyJsonObjectToLoroMap(loroMap, { a: 2, b: "hello", $modelType: "test" }, { mode: "merge" })
    doc.commit()
    expect(loroMap.get("a")).toBe(2)
  })

  test("array merge skips unchanged containers", () => {
    const doc = new LoroDoc()
    const loroList = doc.getMovableList("list")
    const snapshot = [1, 2, 3]

    applyJsonArrayToLoroMovableList(loroList, snapshot, { mode: "merge" })
    doc.commit()
    expect(loroList.toArray()).toEqual([1, 2, 3])

    // Same reference - no changes
    applyJsonArrayToLoroMovableList(loroList, snapshot, { mode: "merge" })
    doc.commit()
    expect(loroList.toArray()).toEqual([1, 2, 3])

    // Changed value
    applyJsonArrayToLoroMovableList(loroList, [1, 99, 3], { mode: "merge" })
    doc.commit()
    expect(loroList.toArray()).toEqual([1, 99, 3])
  })

  test("isLoroContainerUpToDate uses reference equality", () => {
    const doc = new LoroDoc()
    const loroMap = doc.getMap("test")
    const snapshot = { a: 1, b: 2 }

    expect(loroSnapshotTracking.isLoroContainerUpToDate(loroMap, snapshot)).toBe(false)

    loroSnapshotTracking.setLoroContainerSnapshot(loroMap, snapshot)
    expect(loroSnapshotTracking.isLoroContainerUpToDate(loroMap, snapshot)).toBe(true)
    expect(loroSnapshotTracking.isLoroContainerUpToDate(loroMap, { a: 1, b: 2 })).toBe(false) // different ref
  })

  test("snapshot tracking updates after each sync", () => {
    @testModel("loro-snapshot-tracking-multi-sync")
    class SimpleModel extends Model({
      value: tProp(types.number, 0),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("testModel")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: SimpleModel,
    })
    autoDispose(dispose)

    const snapshot1 = getSnapshot(boundObject)
    expect(loroSnapshotTracking.isLoroContainerUpToDate(loroMap, snapshot1)).toBe(true)

    runUnprotected(() => {
      boundObject.value = 10
    })

    const snapshot2 = getSnapshot(boundObject)
    expect(loroSnapshotTracking.isLoroContainerUpToDate(loroMap, snapshot2)).toBe(true)
    expect(loroSnapshotTracking.isLoroContainerUpToDate(loroMap, snapshot1)).toBe(false)
  })
})

describe("array update with same ID", () => {
  @testModel("binding-item-with-id")
  class ItemWithId extends Model({
    id: idProp,
    name: tProp(types.string),
    value: tProp(types.number, 0),
  }) {}

  test("replacing model with same ID but different content should preserve updates", () => {
    @testModel("binding-replace-same-id-container")
    class ContainerForReplaceTest extends Model({
      items: prop<ItemWithId[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: ContainerForReplaceTest,
    })
    autoDispose(dispose)

    // Add initial items
    runUnprotected(() => {
      boundObject.items = [
        new ItemWithId({ name: "A", value: 1 }),
        new ItemWithId({ name: "B", value: 2 }),
      ]
    })

    const loroItems = loroMap.get("items") as LoroMovableList

    // Get the ID of first item
    const firstItemId = boundObject.items[0].$modelId

    // Create a new item with same model type but we're replacing at index
    runUnprotected(() => {
      boundObject.items[0] = new ItemWithId({ name: "A-updated", value: 100 })
    })

    // The new item should have different content
    expect(boundObject.items[0].name).toBe("A-updated")
    expect(boundObject.items[0].value).toBe(100)

    // Loro should reflect the update
    const loroItem = loroItems.get(0) as LoroMap
    expect(loroItem.get("name")).toBe("A-updated")
    expect(loroItem.get("value")).toBe(100)

    // And it should be a different model ID (new instance)
    expect(boundObject.items[0].$modelId).not.toBe(firstItemId)
  })

  test("modifying model properties after move should sync correctly", () => {
    @testModel("binding-move-modify-container")
    class ContainerForMoveModifyTest extends Model({
      items: prop<ItemWithId[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: ContainerForMoveModifyTest,
    })
    autoDispose(dispose)

    runUnprotected(() => {
      boundObject.items = [
        new ItemWithId({ name: "A", value: 1 }),
        new ItemWithId({ name: "B", value: 2 }),
        new ItemWithId({ name: "C", value: 3 }),
      ]
    })

    const itemA = boundObject.items[0]
    const loroItems = loroMap.get("items") as LoroMovableList

    // Move A to end and modify it in same action
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.push(itemA)
      itemA.value = 999
      itemA.name = "A-modified"
    })

    expect(boundObject.items[2].name).toBe("A-modified")
    expect(boundObject.items[2].value).toBe(999)

    // Loro should have the updated values
    const loroItemA = loroItems.get(2) as LoroMap
    expect(loroItemA.get("name")).toBe("A-modified")
    expect(loroItemA.get("value")).toBe(999)
  })
})

describe("frozen objects", () => {
  test("frozen objects should work correctly", () => {
    @testModel("binding-frozen-object-container")
    class FrozenObjectContainer extends Model({
      data: tProp(types.frozen(types.unchecked<{ value: number }>()), () => frozen({ value: 0 })),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: FrozenObjectContainer,
    })
    autoDispose(dispose)

    // Set frozen data
    runUnprotected(() => {
      boundObject.data = frozen({ value: 42 })
    })

    // Frozen snapshots include $frozen marker
    const loroData = loroMap.toJSON().data as { $frozen: boolean; data: { value: number } }
    expect(loroData.$frozen).toBe(true)
    expect(loroData.data.value).toBe(42)

    // Update to new frozen value
    runUnprotected(() => {
      boundObject.data = frozen({ value: 100 })
    })

    const loroData2 = loroMap.toJSON().data as { $frozen: boolean; data: { value: number } }
    expect(loroData2.data.value).toBe(100)
  })
})

describe("path key collisions", () => {
  @testModel("binding-path-item")
  class PathItem extends Model({
    id: idProp,
    name: tProp(types.string),
    value: tProp(types.number, 0),
  }) {}

  test("object key '1' vs array index 1 should not collide", () => {
    @testModel("binding-path-collision-container")
    class PathCollisionContainer extends Model({
      // Record with string keys
      recordItems: prop<Record<string, PathItem>>(() => ({})),
      // Array with numeric indices
      arrayItems: prop<PathItem[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: PathCollisionContainer,
    })
    autoDispose(dispose)

    // Add items to both
    runUnprotected(() => {
      boundObject.recordItems["1"] = new PathItem({ name: "record-1", value: 1 })
      boundObject.arrayItems[0] = new PathItem({ name: "array-0", value: 0 })
      boundObject.arrayItems[1] = new PathItem({ name: "array-1", value: 1 })
    })

    // Modify both in same action
    runUnprotected(() => {
      boundObject.recordItems["1"].value = 100
      boundObject.arrayItems[1].value = 200
    })

    // Both should have updated correctly
    expect(boundObject.recordItems["1"].value).toBe(100)
    expect(boundObject.arrayItems[1].value).toBe(200)

    // Check Loro
    const loroRecord = loroMap.get("recordItems") as LoroMap
    const loroArray = loroMap.get("arrayItems") as LoroMovableList
    expect((loroRecord.get("1") as LoroMap).get("value")).toBe(100)
    expect((loroArray.get(1) as LoroMap).get("value")).toBe(200)
  })
})

describe("type validation", () => {
  test("reconcile should handle non-array paths gracefully", () => {
    @testModel("binding-type-validation-container")
    class TypeValidationContainer extends Model({
      notAnArray: tProp(types.string, "hello"),
      items: prop<string[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: TypeValidationContainer,
    })
    autoDispose(dispose)

    // Normal operation should work
    runUnprotected(() => {
      boundObject.notAnArray = "world"
      boundObject.items.push("test")
    })

    expect(boundObject.notAnArray).toBe("world")
    expect(boundObject.items.length).toBe(1)
  })
})
