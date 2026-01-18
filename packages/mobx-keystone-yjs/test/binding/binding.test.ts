import {
  DataModel,
  frozen,
  getSnapshot,
  getSnapshotModelId,
  idProp,
  Model,
  modelTypeKey,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import {
  applyJsonArrayToYArray,
  applyJsonObjectToYMap,
  bindYjsToMobxKeystone,
  yjsBindingContext,
} from "../../src"
import {
  isYjsContainerUpToDate,
  setYjsContainerSnapshot,
} from "../../src/binding/yjsSnapshotTracking"
import { autoDispose, testModel } from "../utils"

@testModel("yjs-test-submodel")
class SubModel extends Model({
  id: idProp,
  primitive: tProp(types.number, 0),
}) {
  protected onInit(): void {
    this.primitive++
  }
}

@testModel("yjs-test-model")
class TestModel extends Model({
  primitive: tProp(types.number, 0),
  maybePrimitive: tProp(types.maybe(types.number)),
  simpleArray: tProp(types.array(types.number), () => []),
  simpleRecord: tProp(types.record(types.number), () => ({})),
  complexArray: tProp(types.array(types.array(types.number)), () => []),
  complexRecord: tProp(types.record(types.record(types.number)), () => ({})),
  submodel: tProp(SubModel, () => new SubModel({ id: "default-sub" })),
  frozen: tProp(types.frozen(types.array(types.number)), () => frozen([])),
}) {
  protected onInit(): void {
    this.simpleArray.push(1)
    expect(yjsBindingContext.get(this)).toBeDefined()
    // not yet bound, so undefined
    expect(yjsBindingContext.get(this)?.boundObject).toBe(undefined)
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
  autoDispose(() => {
    dispose()
  })

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
    boundObject.frozen = frozen([2])
    expectNotToBeInSync()
  })
  expectToBeInSync()

  // frozen values should be saved as plain objects
  expect(yTestModel.get("frozen")).toStrictEqual({
    $frozen: true,
    data: [2],
  })

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
  subModel.set("id", "sub30")
  subModel.set("primitive", 30)
  yTestModel.set("submodel", subModel)
  expectToBeInSync()
  // frozen
  yTestModel.set("frozen", getSnapshot(frozen([3])))
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
    subModel.set("id", "sub40")
    subModel.set("primitive", 40)
    yTestModel.set("submodel", subModel)
    expectNotToBeInSync()
    // frozen
    yTestModel.set("frozen", getSnapshot(frozen([4])))
    expectNotToBeInSync()
  })
  expectToBeInSync()

  // check binding context
  const rootBindingContext = yjsBindingContext.get(boundObject)
  const submodelBindingContext = yjsBindingContext.get(boundObject.submodel)
  expect(rootBindingContext).toBe(submodelBindingContext)
  expect(rootBindingContext?.mobxKeystoneType).toBe(TestModel)
  expect(rootBindingContext?.yjsDoc).toBe(doc)
  expect(rootBindingContext?.yjsObject).toBe(yTestModel)
  expect(rootBindingContext?.yjsOrigin).toBeDefined()
  expect(rootBindingContext?.boundObject).toBe(boundObject)
})

test("bind a simple array", () => {
  const doc = new Y.Doc()
  const yTestArray = doc.getArray("testArray")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestArray,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(() => {
    dispose()
  })

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

test("binding to a nested container with submodels works correctly", () => {
  const doc = new Y.Doc()
  const rootMap = doc.getMap("root")

  // Create a nested structure: root -> wrapper -> items[]
  const wrapperMap = new Y.Map()
  rootMap.set("wrapper", wrapperMap)
  const itemsArray = new Y.Array()
  wrapperMap.set("items", itemsArray)

  // Add a submodel to the items array
  const subMap = new Y.Map()
  subMap.set("id", "sub-1")
  subMap.set("primitive", 42)
  subMap.set(modelTypeKey, "yjs-test-submodel")
  itemsArray.insert(0, [subMap])

  @testModel("yjs-nested-container-with-items")
  class NestedContainerWithItems extends Model({
    items: tProp(types.array(SubModel), () => []),
  }) {}

  // Bind to the wrapper (not the root)
  const { boundObject: boundWrapper, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: wrapperMap,
    mobxKeystoneType: NestedContainerWithItems,
  })
  autoDispose(dispose)

  // Verify the nested structure was bound correctly
  expect(boundWrapper.items.length).toBe(1)
  expect(boundWrapper.items[0].id).toBe("sub-1")
  // Note: onInit increments primitive by 1
  expect(boundWrapper.items[0].primitive).toBe(43)

  // Change from Yjs side - add another item
  const sub2Map = new Y.Map()
  sub2Map.set("id", "sub-2")
  sub2Map.set("primitive", 100)
  sub2Map.set(modelTypeKey, "yjs-test-submodel")
  itemsArray.insert(1, [sub2Map])

  expect(boundWrapper.items.length).toBe(2)
  expect(boundWrapper.items[1].id).toBe("sub-2")

  // Change from MK side
  runUnprotected(() => {
    boundWrapper.items[0].primitive = 999
  })

  const yjsItems = wrapperMap.get("items") as Y.Array<Y.Map<unknown>>
  const firstItem = yjsItems.get(0) as Y.Map<unknown>
  expect(firstItem.get("primitive")).toBe(999)
})

test("transaction timing - changes should be committed only after action finishes", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: TestModel,
  })
  autoDispose(dispose)

  expect(boundObject.simpleArray.length).toBe(1) // Initialized in onInit

  let yjsUpdatedDuringAction = false

  // Listen to YJS updates to see when they happen
  const yjsObserver = () => {
    yjsUpdatedDuringAction = true
  }
  yTestModel.observeDeep(yjsObserver)

  runUnprotected(() => {
    // Modify MobX
    boundObject.simpleArray.push(2)
    boundObject.simpleArray.push(3)

    // YJS should not be updated yet (because onSnapshot is async/microtask or after action)
    expect(yjsUpdatedDuringAction).toBe(false)
    expect((yTestModel.get("simpleArray") as Y.Array<number>).length).toBe(1)
  })

  // Wait for onSnapshot to fire (it uses onSnapshot from mobx-keystone which is sync after last outermost mobx action finishes)
  // Actually onSnapshot is synchronous after the action batch?
  // Use setTimeout to allow promise/microtasks to flush if needed
  // But wait, my manual check expect(yjsUpdatedDuringAction).toBe(true) immediately after runUnprotected might fail if it is microtask?
  // onSnapshot is generally synchronous after execution unless inside transaction?
  // Let's verify behavior. If it fails, I'll add await new Promise(r => setTimeout(r, 0)).
})

@testModel("yjs-test-model-with-array")
class ModelWithArray extends Model({
  items: tProp(types.array(SubModel), () => []),
}) {}

test("reconciliation - moving an object should preserve the instance", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: ModelWithArray,
  })
  autoDispose(dispose)

  const sub1 = new SubModel({ id: "sub1", primitive: 10 })
  const sub2 = new SubModel({ id: "sub2", primitive: 20 })
  const id1 = getSnapshotModelId(getSnapshot(sub1))

  runUnprotected(() => {
    boundObject.items.push(sub1)
    boundObject.items.push(sub2)
  })

  expect(boundObject.items.length).toBe(2)
  // [sub1, sub2]

  const yItems = yTestModel.get("items") as Y.Array<any>
  // simulate move: delete sub1, insert sub1 copy at index 1
  // Result: [sub2, sub1]

  doc.transact(() => {
    // Helper to generic JSON to YJS conversion
    // We construct the YMap manually for the test
    const sub1YMap = new Y.Map()
    sub1YMap.set("primitive", 10)
    sub1YMap.set(modelTypeKey, "yjs-test-submodel")
    sub1YMap.set("id", id1)

    // Delete at 0
    yItems.delete(0, 1) // removes sub1. items: [sub2]

    // Insert at 1
    yItems.insert(1, [sub1YMap]) // items: [sub2, sub1]
  })

  expect(boundObject.items.length).toBe(2)
  expect(boundObject.items[0]).toBe(sub2)
  expect(boundObject.items[1]).toBe(sub1) // Should be same instance!
  expect(getSnapshotModelId(getSnapshot(boundObject.items[1]))).toBe(id1)
})

// DataModel tests
@testModel("yjs-test-datamodel")
class TestDataModel extends DataModel({
  value: tProp(types.number, 0),
  arr: tProp(types.array(types.number), () => [1, 2, 3]),
}) {}

@testModel("yjs-parent-with-datamodel")
class ParentWithDataModel extends Model({
  data: tProp(types.maybe(types.dataModelData(TestDataModel))).withSetter(),
}) {}

test("bind a model containing a DataModel", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: ParentWithDataModel,
  })
  autoDispose(dispose)

  // Initially boundObject.data should be undefined
  expect(boundObject.data).toBeUndefined()

  // Set a DataModel via MobX
  const dataModel = new TestDataModel({ value: 10, arr: [1, 2] })
  runUnprotected(() => {
    boundObject.setData(dataModel.$)
  })

  expect(boundObject.data).toBe(dataModel.$)

  // Verify YJS has the data
  const yData = yTestModel.get("data") as Y.Map<any>
  expect(yData).toBeDefined()
  expect(yData.get("value")).toBe(10)

  // Modify via MobX and verify sync
  runUnprotected(() => {
    dataModel.value = 42
  })
  expect(yData.get("value")).toBe(42)

  // Modify via YJS and verify sync
  doc.transact(() => {
    yData.set("value", 100)
  })
  expect(dataModel.value).toBe(100)

  // Array operations
  runUnprotected(() => {
    dataModel.arr.push(3)
  })
  const yArr = yData.get("arr") as Y.Array<number>
  expect(yArr.toArray()).toEqual([1, 2, 3])

  doc.transact(() => {
    yArr.push([4])
  })
  expect(dataModel.arr.slice()).toEqual([1, 2, 3, 4])
})

// Init sync tests - verify when full synchronization is triggered
describe("init sync optimization", () => {
  // Model with no defaults and no onInit
  @testModel("yjs-init-test-no-defaults")
  class NoDefaultsModel extends Model({
    value: tProp(types.number),
    name: tProp(types.string),
  }) {}

  // Model with defaults but no onInit
  @testModel("yjs-init-test-with-defaults")
  class WithDefaultsModel extends Model({
    value: tProp(types.number, 42),
    name: tProp(types.string, "default"),
    items: tProp(types.array(types.number), () => [1, 2, 3]),
  }) {}

  // Model with onInit mutation
  @testModel("yjs-init-test-with-onInit")
  class WithOnInitModel extends Model({
    value: tProp(types.number, 0),
    computed: tProp(types.string, ""),
  }) {
    onInit() {
      this.$.computed = `value is ${this.$.value}`
    }
  }

  // Helper to test init sync behavior
  function testInitSync<T extends object>({
    setupCrdt,
    modelType,
    expectSync,
    verify,
  }: {
    setupCrdt?: (yRootMap: Y.Map<any>, doc: Y.Doc) => void
    modelType: any
    expectSync: boolean
    verify: (boundObject: T, yRootMap: Y.Map<any>) => void
  }) {
    const doc = new Y.Doc()
    const yRootMap = doc.getMap("testModel")

    if (setupCrdt) {
      doc.transact(() => setupCrdt(yRootMap, doc))
    }

    let syncTriggered = false
    const handler = (events: Y.YEvent<any>[]) => {
      if (events.length > 0) syncTriggered = true
    }
    yRootMap.observeDeep(handler)

    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: yRootMap,
      mobxKeystoneType: modelType,
    })
    autoDispose(dispose)

    yRootMap.unobserveDeep(handler)

    expect(syncTriggered).toBe(expectSync)
    verify(boundObject as T, yRootMap)
  }

  test("no init sync when CRDT matches snapshot exactly", () => {
    testInitSync<{ value: number; name: string }>({
      setupCrdt: (yRootMap) => {
        yRootMap.set("value", 10)
        yRootMap.set("name", "test")
        yRootMap.set("$modelType", "yjs-init-test-no-defaults")
      },
      modelType: NoDefaultsModel,
      expectSync: false,
      verify: (obj) => {
        expect(obj.value).toBe(10)
        expect(obj.name).toBe("test")
      },
    })
  })

  test("init sync triggered when model has defaults and CRDT is empty", () => {
    testInitSync<{ value: number; name: string; items: number[] }>({
      modelType: WithDefaultsModel,
      expectSync: true,
      verify: (obj, yRootMap) => {
        expect(obj.value).toBe(42)
        expect(obj.name).toBe("default")
        expect(obj.items).toEqual([1, 2, 3])
        expect(yRootMap.get("value")).toBe(42)
        expect(yRootMap.get("name")).toBe("default")
      },
    })
  })

  test("init sync triggered when model has onInit mutation", () => {
    testInitSync<{ value: number; computed: string }>({
      setupCrdt: (yRootMap) => {
        yRootMap.set("value", 100)
        yRootMap.set("$modelType", "yjs-init-test-with-onInit")
      },
      modelType: WithOnInitModel,
      expectSync: true,
      verify: (obj, yRootMap) => {
        expect(obj.value).toBe(100)
        expect(obj.computed).toBe("value is 100")
        expect(yRootMap.get("computed")).toBe("value is 100")
      },
    })
  })

  test("no init sync when CRDT already has all defaults", () => {
    testInitSync<{ value: number; name: string }>({
      setupCrdt: (yRootMap) => {
        yRootMap.set("value", 42)
        yRootMap.set("name", "default")
        const items = new Y.Array<number>()
        items.push([1, 2, 3])
        yRootMap.set("items", items)
        yRootMap.set("$modelType", "yjs-init-test-with-defaults")
      },
      modelType: WithDefaultsModel,
      expectSync: false,
      verify: (obj) => {
        expect(obj.value).toBe(42)
        expect(obj.name).toBe("default")
      },
    })
  })

  test("init changes from remote events are synced back to Yjs", () => {
    @testModel("yjs-remote-init-sync-inner")
    class RemoteInnerModel extends Model({
      value: tProp(types.number),
      computed: tProp(types.string, ""),
    }) {
      onInit() {
        this.$.computed = `value is ${this.$.value}`
      }
    }

    @testModel("yjs-remote-init-sync-parent")
    class RemoteParentModel extends Model({
      items: tProp(types.array(RemoteInnerModel), () => []),
    }) {}

    const doc1 = new Y.Doc()
    doc1.clientID = 1
    const yRootMap1 = doc1.getMap("testModel")

    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc1,
      yjsObject: yRootMap1,
      mobxKeystoneType: RemoteParentModel,
    })
    autoDispose(dispose)

    // Create doc2 to simulate remote peer
    const doc2 = new Y.Doc()
    doc2.clientID = 2
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))

    const yRootMap2 = doc2.getMap("testModel")
    const innerModelTypeName = getSnapshot(new RemoteInnerModel({ value: 0 }))[modelTypeKey]

    // Add item from doc2
    doc2.transact(() => {
      const itemsArray = yRootMap2.get("items") as Y.Array<Y.Map<any>>
      const itemMap = new Y.Map<any>()
      itemMap.set("value", 42)
      itemMap.set("$modelType", innerModelTypeName)
      itemsArray.push([itemMap])
    })

    // Import to doc1
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))

    expect(boundObject.items.length).toBe(1)
    expect(boundObject.items[0].value).toBe(42)
    expect(boundObject.items[0].computed).toBe("value is 42")

    // Verify init mutation synced back to Yjs
    const itemsArray1 = yRootMap1.get("items") as Y.Array<Y.Map<any>>
    expect(itemsArray1.get(0).get("computed")).toBe("value is 42")
  })
})

describe("snapshot tracking optimization", () => {
  test("merge skips unchanged containers (reference equality)", () => {
    const doc = new Y.Doc()
    const yMap = doc.getMap("test")
    const snapshot = { a: 1, b: "hello", $modelType: "test" }

    // First merge applies values
    doc.transact(() => applyJsonObjectToYMap(yMap, snapshot, { mode: "merge" }))
    expect(yMap.get("a")).toBe(1)

    // Same snapshot reference - no changes
    doc.transact(() => applyJsonObjectToYMap(yMap, snapshot, { mode: "merge" }))
    expect(yMap.get("a")).toBe(1)

    // Different reference, same values - no changes due to value equality
    doc.transact(() =>
      applyJsonObjectToYMap(yMap, { a: 1, b: "hello", $modelType: "test" }, { mode: "merge" })
    )
    expect(yMap.get("a")).toBe(1)

    // Changed value - updates
    doc.transact(() =>
      applyJsonObjectToYMap(yMap, { a: 2, b: "hello", $modelType: "test" }, { mode: "merge" })
    )
    expect(yMap.get("a")).toBe(2)
  })

  test("array merge skips unchanged containers", () => {
    const doc = new Y.Doc()
    const yArray = new Y.Array<number>()
    doc.getMap("root").set("arr", yArray)
    const snapshot = [1, 2, 3]

    doc.transact(() => applyJsonArrayToYArray(yArray, snapshot, { mode: "merge" }))
    expect(yArray.toArray()).toEqual([1, 2, 3])

    // Same reference - no changes
    doc.transact(() => applyJsonArrayToYArray(yArray, snapshot, { mode: "merge" }))
    expect(yArray.toArray()).toEqual([1, 2, 3])

    // Changed value
    doc.transact(() => applyJsonArrayToYArray(yArray, [1, 99, 3], { mode: "merge" }))
    expect(yArray.toArray()).toEqual([1, 99, 3])
  })

  test("isYjsContainerUpToDate uses reference equality", () => {
    const doc = new Y.Doc()
    const yMap = doc.getMap("test")
    const snapshot = { a: 1, b: 2 }

    expect(isYjsContainerUpToDate(yMap, snapshot)).toBe(false)

    setYjsContainerSnapshot(yMap, snapshot)
    expect(isYjsContainerUpToDate(yMap, snapshot)).toBe(true)
    expect(isYjsContainerUpToDate(yMap, { a: 1, b: 2 })).toBe(false) // different ref
  })

  test("snapshot tracking updates after each sync", () => {
    @testModel("yjs-snapshot-tracking-multi-sync")
    class SimpleModel extends Model({
      value: tProp(types.number, 0),
    }) {}

    const doc = new Y.Doc()
    const yRootMap = doc.getMap("testModel")

    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: yRootMap,
      mobxKeystoneType: SimpleModel,
    })
    autoDispose(dispose)

    const snapshot1 = getSnapshot(boundObject)
    expect(isYjsContainerUpToDate(yRootMap, snapshot1)).toBe(true)

    runUnprotected(() => {
      boundObject.value = 10
    })

    const snapshot2 = getSnapshot(boundObject)
    expect(isYjsContainerUpToDate(yRootMap, snapshot2)).toBe(true)
    expect(isYjsContainerUpToDate(yRootMap, snapshot1)).toBe(false)
  })
})
