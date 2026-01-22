import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { idProp, Model, model, prop, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

@model("MoveTestItem")
class TestItem extends Model({
  id: idProp,
  name: tProp(types.string),
  value: tProp(types.number, 0),
}) {}

@model("MoveArrayContainer")
class ArrayContainer extends Model({
  items: prop<TestItem[]>(() => []),
}) {}

@model("MoveTest/TestModelCustomId")
class TestModelCustomId extends Model({
  myCustomId: idProp,
  name: tProp(types.string),
}) {}

@model("MoveTest/CustomIdContainer")
class CustomIdContainer extends Model({
  items: prop<TestModelCustomId[]>(() => []),
}) {}

/**
 * Helper to sync two Loro docs (simulates network sync)
 */
function syncDocs(doc1: LoroDoc, doc2: LoroDoc) {
  const state1 = doc1.export({ mode: "update" })
  const state2 = doc2.export({ mode: "update" })
  doc1.import(state2)
  doc2.import(state1)
}

/**
 * Helper to create an item in a LoroMovableList
 */
function createLoroItem(
  items: LoroMovableList,
  index: number,
  id: string,
  name: string,
  value: number
) {
  const item = items.insertContainer(index, new LoroMap())
  item.set("$modelType", "MoveTestItem")
  item.set("$modelId", id)
  item.set("id", id) // idProp uses "id" as the snapshot key
  item.set("name", name)
  item.set("value", value)
  return item
}

function setupMoveTest(initialItems: { id: string; name: string; value: number }[] = []) {
  const doc = new LoroDoc()
  const loroMap = doc.getMap("root")
  loroMap.set("$modelType", "MoveArrayContainer")
  loroMap.set("$modelId", "container")
  const items = loroMap.setContainer("items", new LoroMovableList())

  initialItems.forEach((item, i) => {
    createLoroItem(items, i, item.id, item.name, item.value)
  })
  doc.commit()

  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: loroMap,
    mobxKeystoneType: ArrayContainer,
  })
  autoDispose(dispose)

  return { doc, loroMap, items, boundObject }
}

function expectItems(
  boundObject: ArrayContainer,
  loroItems: LoroMovableList,
  expectedNames: string[]
) {
  expect(boundObject.items.map((i) => i.name)).toEqual(expectedNames)
  expect(loroItems.length).toBe(expectedNames.length)
  for (let i = 0; i < expectedNames.length; i++) {
    expect((loroItems.get(i) as LoroMap).get("name")).toBe(expectedNames[i])
  }
}

function getLoroContainerIdForModelId(loroItems: LoroMovableList, modelId: string): string {
  for (let i = 0; i < loroItems.length; i++) {
    const item = loroItems.get(i)
    if (item instanceof LoroMap && item.get("$modelId") === modelId) {
      return item.id
    }
  }
  throw new Error(`Could not find modelId ${modelId} in Loro list`)
}

describe("move operations", () => {
  test("moving an item from first to last position", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "first", value: 0 },
      { id: "item-1", name: "second", value: 1 },
      { id: "item-2", name: "third", value: 2 },
    ])

    // Move first item to last position
    const firstItem = boundObject.items[0]!
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.push(firstItem)
    })

    expectItems(boundObject, loroItems, ["second", "third", "first"])
  })

  test("moving an item from last to first position", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "first", value: 0 },
      { id: "item-1", name: "second", value: 1 },
      { id: "item-2", name: "third", value: 2 },
    ])

    const lastItem = boundObject.items[2]!
    runUnprotected(() => {
      boundObject.items.splice(2, 1)
      boundObject.items.unshift(lastItem)
    })

    expectItems(boundObject, loroItems, ["third", "first", "second"])
  })

  test("moving an item to the middle", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "first", value: 0 },
      { id: "item-1", name: "second", value: 1 },
      { id: "item-2", name: "third", value: 2 },
    ])

    const firstItem = boundObject.items[0]!
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.splice(1, 0, firstItem)
    })

    expectItems(boundObject, loroItems, ["second", "first", "third"])
  })

  test("moving multiple items", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
      { id: "item-3", name: "D", value: 3 },
    ])

    const itemA = boundObject.items[0]!
    const itemB = boundObject.items[1]!
    runUnprotected(() => {
      boundObject.items.splice(0, 2)
      boundObject.items.splice(1, 0, itemA, itemB)
    })

    expectItems(boundObject, loroItems, ["C", "A", "B", "D"])
  })

  test("moving an item to its own position (no-op)", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
    ])

    const itemA = boundObject.items[0]!
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.splice(0, 0, itemA)
    })

    expectItems(boundObject, loroItems, ["A", "B"])
  })

  test("moving an item in a record (should just work as a set)", () => {
    @model("MoveRecordContainer")
    class RecordContainer extends Model({
      items: prop<Record<string, TestItem>>(() => ({})),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: RecordContainer,
    })
    autoDispose(dispose)

    const itemA = new TestItem({ name: "A", value: 1 })
    runUnprotected(() => {
      boundObject.items.a = itemA
    })

    runUnprotected(() => {
      delete boundObject.items.a
      boundObject.items.b = itemA
    })

    expect(boundObject.items.a).toBeUndefined()
    expect(boundObject.items.b).toBe(itemA)
    const loroRecord = loroMap.get("items") as LoroMap
    expect(loroRecord.get("a")).toBeUndefined()
    expect((loroRecord.get("b") as LoroMap).get("name")).toBe("A")
  })

  test("concurrent move and property change should preserve both", () => {
    const { doc: docA, boundObject: boundA } = setupMoveTest([
      { id: "item-0", name: "moveable", value: 0 },
      { id: "item-1", name: "second", value: 1 },
      { id: "item-2", name: "third", value: 2 },
    ])
    docA.setPeerId(1n)

    // Client B setup - sync from A
    const docB = new LoroDoc()
    docB.setPeerId(2n)
    docB.import(docA.export({ mode: "snapshot" }))
    const loroMapB = docB.getMap("root")

    const { boundObject: boundB, dispose: disposeB } = bindLoroToMobxKeystone({
      loroDoc: docB,
      loroObject: loroMapB,
      mobxKeystoneType: ArrayContainer,
    })
    autoDispose(disposeB)

    // Client A: Move item from first to last (offline)
    const itemToMove = boundA.items[0]!
    runUnprotected(() => {
      boundA.items.splice(0, 1)
      boundA.items.push(itemToMove)
    })

    // Client B: Change property of the first item (what A is moving) - this is offline
    runUnprotected(() => {
      boundB.items[0]!.value = 999
      boundB.items[0]!.name = "modified"
    })

    // Sync both docs
    syncDocs(docA, docB)

    // After sync, the item should be moved AND have the updated property
    for (const bound of [boundA, boundB]) {
      expect(bound.items.length).toBe(3)
      const modifiedItem = bound.items.find((item) => item.$modelId === "item-0")!
      expect(modifiedItem.value).toBe(999)
      expect(modifiedItem.name).toBe("modified")
    }

    // The positions should be consistent
    expect(boundA.items.map((i) => i.$modelId)).toEqual(boundB.items.map((i) => i.$modelId))
  })

  test("move in mobx-keystone triggers Loro native move", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
    ])

    // Capture Loro container IDs to verify identity preservation
    const ids = [0, 1, 2].map((i) => (loroItems.get(i) as LoroMap).id)

    // Move item 0 to position 2 (from [A,B,C] to [B,C,A])
    const itemA = boundObject.items[0]!
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.splice(2, 0, itemA)
    })

    expectItems(boundObject, loroItems, ["B", "C", "A"])

    // The item identities should be preserved (same container IDs)
    // This verifies native move was used, not delete+insert
    expect((loroItems.get(0) as LoroMap).id).toBe(ids[1])
    expect((loroItems.get(1) as LoroMap).id).toBe(ids[2])
    expect((loroItems.get(2) as LoroMap).id).toBe(ids[0])
  })

  test("Loro native move syncs to mobx-keystone", () => {
    const {
      boundObject,
      items: loroItems,
      doc,
    } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
    ])

    // Use Loro native move (simulating external change)
    loroItems.move(0, 2)
    doc.commit()

    expect(boundObject.items.map((i) => i.name)).toEqual(["B", "C", "A"])
    expect(boundObject.items[2]!.$modelId).toBe("item-0")
  })

  test("sequential move and edit across clients", () => {
    const { doc: docA, boundObject: boundA } = setupMoveTest(
      Array.from({ length: 5 }, (_, i) => ({ id: `item-${i}`, name: `item${i}`, value: i }))
    )
    docA.setPeerId(1n)

    // Client B syncs from A
    const docB = new LoroDoc()
    docB.setPeerId(2n)
    docB.import(docA.export({ mode: "snapshot" }))
    const loroMapB = docB.getMap("root")

    const { boundObject: boundB, dispose: disposeB } = bindLoroToMobxKeystone({
      loroDoc: docB,
      loroObject: loroMapB,
      mobxKeystoneType: ArrayContainer,
    })
    autoDispose(disposeB)

    // Client A: Move item 0 to end
    const item0A = boundA.items[0]!
    runUnprotected(() => {
      boundA.items.splice(0, 1)
      boundA.items.push(item0A)
    })

    // Sync A to B
    docB.import(docA.export({ mode: "update" }))
    expect(boundB.items[4]!.$modelId).toBe("item-0")

    // Client B: Edit the moved item
    runUnprotected(() => {
      boundB.items[4]!.value = 1000
    })

    // Sync B to A
    docA.import(docB.export({ mode: "update" }))

    // Both docs should have consistent state
    for (const bound of [boundA, boundB]) {
      expect(bound.items.length).toBe(5)
      expect(bound.items[4]!.value).toBe(1000)
      expect(bound.items.map((i) => i!.$modelId)).toEqual([
        "item-1",
        "item-2",
        "item-3",
        "item-4",
        "item-0",
      ])
    }
  })

  test("moving items in a newly created array within same commit triggers proper sync", () => {
    const { doc, boundObject, items: loroItems } = setupMoveTest()

    // Create a second doc that will receive the changes
    const doc2 = new LoroDoc()
    doc2.import(doc.export({ mode: "snapshot" }))
    const loroMap2 = doc2.getMap("root")
    const { boundObject: boundObject2, dispose: dispose2 } = bindLoroToMobxKeystone({
      loroDoc: doc2,
      loroObject: loroMap2,
      mobxKeystoneType: ArrayContainer,
    })
    autoDispose(dispose2)

    // In first doc: create items AND move them in same snapshot
    runUnprotected(() => {
      const itemA = new TestItem({ name: "A", value: 1 })
      boundObject.items.push(itemA)
      boundObject.items.push(new TestItem({ name: "B", value: 2 }))
      boundObject.items.push(new TestItem({ name: "C", value: 3 }))

      // Move A to end
      boundObject.items.splice(0, 1)
      boundObject.items.push(itemA)
    })

    // Sync to second doc
    doc2.import(doc.export({ mode: "update" }))

    // Verify both
    const expected = ["B", "C", "A"]
    expectItems(boundObject, loroItems, expected)
    expectItems(boundObject2, doc2.getMap("root").get("items") as LoroMovableList, expected)
  })

  test("moving items in a deeply nested newly created array within same commit", () => {
    const { boundObject, loroMap } = setupMoveTest()

    // In one commit: create the array AND add items AND move them
    runUnprotected(() => {
      const itemA = new TestItem({ name: "A", value: 1 })
      boundObject.items = [itemA, new TestItem({ name: "B", value: 2 })]
      boundObject.items.splice(0, 1)
      boundObject.items.push(itemA)
    })

    expectItems(boundObject, loroMap.get("items") as LoroMovableList, ["B", "A"])
  })

  test("multiple moves in the same commit", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
      { id: "item-3", name: "D", value: 3 },
    ])

    // [A, B, C, D] -> [B, C, D, A] -> [C, D, A, B]
    runUnprotected(() => {
      const itemA = boundObject.items[0]!
      const itemB = boundObject.items[1]!
      boundObject.items.splice(0, 2)
      boundObject.items.push(itemA)
      boundObject.items.push(itemB)
    })

    expectItems(boundObject, loroItems, ["C", "D", "A", "B"])
  })

  test("move detection works with custom id property", () => {
    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    // Initialize empty container
    loroMap.set("$modelType", "MoveTest/CustomIdContainer")
    loroMap.setContainer("items", new LoroMovableList())

    doc.commit()

    // Create binding
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: CustomIdContainer,
    })
    autoDispose(dispose)

    // Add items with custom id property
    runUnprotected(() => {
      boundObject.items.push(new TestModelCustomId({ name: "A" }))
      boundObject.items.push(new TestModelCustomId({ name: "B" }))
      boundObject.items.push(new TestModelCustomId({ name: "C" }))
    })

    expect(boundObject.items.map((i) => i.name)).toEqual(["A", "B", "C"])

    // Store IDs BEFORE the move
    const itemA = boundObject.items[0]!
    const idA = itemA.myCustomId

    // Move first item to last position
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.push(itemA)
    })

    // Verify mobx-keystone has correct order
    expect(boundObject.items.map((i) => i.name)).toEqual(["B", "C", "A"])

    // Verify Loro has correct order
    const loroItems = loroMap.get("items") as LoroMovableList
    expect(loroItems.toJSON().map((i: any) => i.name)).toEqual(["B", "C", "A"])

    // Verify model ID preserved
    expect(boundObject.items[2]!.myCustomId).toBe(idA)
  })

  test("reordering via reverse() preserves model container identity", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
      { id: "item-3", name: "D", value: 3 },
    ])

    const containerIdsByModelId = new Map(
      boundObject.items.map((item) => [
        item.$modelId,
        getLoroContainerIdForModelId(loroItems, item.$modelId),
      ])
    )

    runUnprotected(() => {
      boundObject.items.reverse()
    })

    expectItems(boundObject, loroItems, ["D", "C", "B", "A"])

    for (const item of boundObject.items) {
      expect(getLoroContainerIdForModelId(loroItems, item.$modelId)).toBe(
        containerIdsByModelId.get(item.$modelId)
      )
    }
  })

  test("reordering via whole-array replacement syncs but replaces the list container", () => {
    const {
      boundObject,
      items: loroItems,
      loroMap,
    } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
    ])

    const a = boundObject.items[0]!
    const b = boundObject.items[1]!
    const c = boundObject.items[2]!

    const oldListId = loroItems.id

    runUnprotected(() => {
      boundObject.items = [c, a, b]
    })

    const newLoroItems = loroMap.get("items") as LoroMovableList
    expect(newLoroItems.id).not.toBe(oldListId)
    expectItems(boundObject, newLoroItems, ["C", "A", "B"])
  })

  test("swapping items via index assignment preserves model container identity", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
    ])

    const containerIdsByModelId = new Map(
      boundObject.items.map((item) => [
        item.$modelId,
        getLoroContainerIdForModelId(loroItems, item.$modelId),
      ])
    )

    runUnprotected(() => {
      // mobx-keystone doesn't allow temporarily duplicating a node in the same array
      // via index assignment, so we do a single splice replacement instead.
      const a = boundObject.items[0]!
      const b = boundObject.items[1]!
      boundObject.items.splice(0, 2, b, a)
    })

    expectItems(boundObject, loroItems, ["B", "A", "C"])

    for (const item of boundObject.items) {
      expect(getLoroContainerIdForModelId(loroItems, item.$modelId)).toBe(
        containerIdsByModelId.get(item.$modelId)
      )
    }
  })

  test("insert and reorder in same transaction preserves existing model containers", () => {
    const { boundObject, items: loroItems } = setupMoveTest([
      { id: "item-0", name: "A", value: 0 },
      { id: "item-1", name: "B", value: 1 },
      { id: "item-2", name: "C", value: 2 },
    ])

    const itemA = boundObject.items[0]!
    const itemB = boundObject.items[1]!
    const itemC = boundObject.items[2]!

    const containerIdsByModelId = new Map(
      boundObject.items.map((item) => [
        item.$modelId,
        getLoroContainerIdForModelId(loroItems, item.$modelId),
      ])
    )

    runUnprotected(() => {
      // [A, B, C] -> [A, X, B, C]
      boundObject.items.splice(1, 0, new TestItem({ name: "X", value: 10 }))

      // Move C to front: [A, X, B, C] -> [C, A, X, B]
      const idx = boundObject.items.indexOf(itemC)
      boundObject.items.splice(idx, 1)
      boundObject.items.unshift(itemC)
    })

    expect(boundObject.items.map((i) => i.name)).toEqual(["C", "A", "X", "B"])
    expect(loroItems.length).toBe(4)

    // Verify existing items preserved container identity
    for (const item of [itemA, itemB, itemC]) {
      expect(getLoroContainerIdForModelId(loroItems, item.$modelId)).toBe(
        containerIdsByModelId.get(item.$modelId)
      )
    }
  })
})

describe("primitive and mixed array operations", () => {
  @testModel("move-primitive-array-container")
  class PrimitiveArrayContainer extends Model({
    items: prop<number[]>(() => []),
  }) {}

  function setupPrimitiveTest() {
    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: PrimitiveArrayContainer,
    })
    autoDispose(dispose)

    return { doc, loroMap, boundObject }
  }

  test("primitives in arrays should not get duplicated during moves", () => {
    const { boundObject, loroMap } = setupPrimitiveTest()

    runUnprotected(() => {
      boundObject.items = [1, 2, 3, 4, 5]
    })

    const loroItems = loroMap.get("items") as LoroMovableList
    expect(loroItems.toArray()).toEqual([1, 2, 3, 4, 5])
    expect(boundObject.items).toEqual([1, 2, 3, 4, 5])

    // Try reordering primitives - this should work correctly
    runUnprotected(() => {
      const first = boundObject.items[0]
      boundObject.items.splice(0, 1)
      boundObject.items.push(first)
    })

    expect(boundObject.items).toEqual([2, 3, 4, 5, 1])
    expect(loroItems.toArray()).toEqual([2, 3, 4, 5, 1])

    // Verify no duplicates
    expect(loroItems.length).toBe(5)
  })

  test("mixed array with models and nulls should sync correctly", () => {
    @testModel("move-mixed-type-container")
    class MixedTypeContainer extends Model({
      items: prop<(TestItem | null)[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: MixedTypeContainer,
    })
    autoDispose(dispose)

    const item1 = new TestItem({ name: "A", value: 1 })
    const item2 = new TestItem({ name: "B", value: 2 })

    runUnprotected(() => {
      boundObject.items = [item1, null, item2, null]
    })

    const loroItems = loroMap.get("items") as LoroMovableList
    expect(loroItems.length).toBe(4)
    expect(boundObject.items.length).toBe(4)

    // Move item1 to end
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.push(item1)
    })

    expect(boundObject.items.length).toBe(4)
    expect(loroItems.length).toBe(4)
    expect(boundObject.items[3]).toBe(item1)
  })

  test("mixed array move should preserve model container identity", () => {
    @testModel("move-mixed-identity-container")
    class MixedIdentityContainer extends Model({
      items: prop<(TestItem | null)[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: MixedIdentityContainer,
    })
    autoDispose(dispose)

    const itemA = new TestItem({ name: "A", value: 1 })
    const itemB = new TestItem({ name: "B", value: 2 })

    runUnprotected(() => {
      boundObject.items = [itemA, null, itemB]
    })

    const loroItems = loroMap.get("items") as LoroMovableList

    // Capture container IDs for the models
    const containerIdA = (loroItems.get(0) as LoroMap).id
    const containerIdB = (loroItems.get(2) as LoroMap).id

    // Move A to end: [A, null, B] -> [null, B, A]
    runUnprotected(() => {
      boundObject.items.splice(0, 1)
      boundObject.items.push(itemA)
    })

    expect(boundObject.items).toEqual([null, itemB, itemA])
    expect(loroItems.length).toBe(3)
    expect(loroItems.get(0)).toBe(null)
    expect((loroItems.get(1) as LoroMap).get("name")).toBe("B")
    expect((loroItems.get(2) as LoroMap).get("name")).toBe("A")

    // Verify container identity was preserved (move, not delete+insert)
    expect((loroItems.get(1) as LoroMap).id).toBe(containerIdB)
    expect((loroItems.get(2) as LoroMap).id).toBe(containerIdA)
  })

  test("mixed array with multiple nulls and moves", () => {
    @testModel("move-multi-null-container")
    class MultiNullContainer extends Model({
      items: prop<(TestItem | null)[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: MultiNullContainer,
    })
    autoDispose(dispose)

    const itemA = new TestItem({ name: "A", value: 1 })
    const itemB = new TestItem({ name: "B", value: 2 })
    const itemC = new TestItem({ name: "C", value: 3 })

    runUnprotected(() => {
      boundObject.items = [null, itemA, null, itemB, null, itemC]
    })

    const loroItems = loroMap.get("items") as LoroMovableList
    expect(loroItems.length).toBe(6)

    // Reverse the models: [null, A, null, B, null, C] -> [null, C, null, B, null, A]
    runUnprotected(() => {
      // Remove A (index 1) and C (index 5)
      boundObject.items.splice(5, 1) // Remove C
      boundObject.items.splice(1, 1) // Remove A
      // Now: [null, null, B, null]
      // Insert C at index 1, A at end
      boundObject.items.splice(1, 0, itemC)
      // Now: [null, C, null, B, null]
      boundObject.items.push(itemA)
      // Now: [null, C, null, B, null, A]
    })

    expect(boundObject.items.map((i) => (i ? i.name : null))).toEqual([
      null,
      "C",
      null,
      "B",
      null,
      "A",
    ])
    expect(loroItems.length).toBe(6)
  })

  test("mixed array preserves exact interleaved positions", () => {
    @testModel("move-interleaved-container")
    class InterleavedContainer extends Model({
      items: prop<(TestItem | number | null)[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: InterleavedContainer,
    })
    autoDispose(dispose)

    const itemA = new TestItem({ name: "A", value: 1 })
    const itemB = new TestItem({ name: "B", value: 2 })

    // Create interleaved array: [1, Model-A, 2, Model-B, 3]
    runUnprotected(() => {
      boundObject.items = [1, itemA, 2, itemB, 3]
    })

    const loroItems = loroMap.get("items") as LoroMovableList
    expect(loroItems.toArray().map((i) => (i instanceof LoroMap ? i.get("name") : i))).toEqual([
      1,
      "A",
      2,
      "B",
      3,
    ])

    // Capture container IDs
    const containerIdA = (loroItems.get(1) as LoroMap).id
    const containerIdB = (loroItems.get(3) as LoroMap).id

    // Move Model-A to end: [1, Model-A, 2, Model-B, 3] -> [1, 2, Model-B, 3, Model-A]
    runUnprotected(() => {
      boundObject.items.splice(1, 1) // Remove A
      boundObject.items.push(itemA) // Add A at end
    })

    expect(
      boundObject.items.map((i) => (typeof i === "number" ? i : i === null ? null : i.name))
    ).toEqual([1, 2, "B", 3, "A"])

    expect(loroItems.toArray().map((i) => (i instanceof LoroMap ? i.get("name") : i))).toEqual([
      1,
      2,
      "B",
      3,
      "A",
    ])

    // Verify container identity preserved
    expect((loroItems.get(2) as LoroMap).id).toBe(containerIdB)
    expect((loroItems.get(4) as LoroMap).id).toBe(containerIdA)
  })

  test("mixed array with no model moves preserves positions exactly", () => {
    @testModel("move-no-change-container")
    class NoChangeContainer extends Model({
      items: prop<(TestItem | number)[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: NoChangeContainer,
    })
    autoDispose(dispose)

    const itemA = new TestItem({ name: "A", value: 1 })
    const itemB = new TestItem({ name: "B", value: 2 })

    // Create interleaved array
    runUnprotected(() => {
      boundObject.items = [1, itemA, 2, itemB]
    })

    const loroItems = loroMap.get("items") as LoroMovableList
    const containerIdA = (loroItems.get(1) as LoroMap).id
    const containerIdB = (loroItems.get(3) as LoroMap).id

    // Just modify a primitive (no model moves)
    runUnprotected(() => {
      boundObject.items[0] = 100
      boundObject.items[2] = 200
    })

    expect(boundObject.items.map((i) => (typeof i === "number" ? i : i.name))).toEqual([
      100,
      "A",
      200,
      "B",
    ])

    expect(loroItems.toArray().map((i) => (i instanceof LoroMap ? i.get("name") : i))).toEqual([
      100,
      "A",
      200,
      "B",
    ])

    // Container identity should be preserved (no moves happened)
    expect((loroItems.get(1) as LoroMap).id).toBe(containerIdA)
    expect((loroItems.get(3) as LoroMap).id).toBe(containerIdB)
  })

  test("unchanged primitives are not deleted and reinserted", () => {
    // This test verifies that primitives that haven't changed are left in place
    @testModel("move-unchanged-primitives-container")
    class UnchangedPrimitivesContainer extends Model({
      items: prop<(TestItem | number)[]>(() => []),
    }) {}

    const doc = new LoroDoc()
    const loroMap = doc.getMap("root")

    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: loroMap,
      mobxKeystoneType: UnchangedPrimitivesContainer,
    })
    autoDispose(dispose)

    const itemA = new TestItem({ name: "A", value: 1 })
    const itemB = new TestItem({ name: "B", value: 2 })

    // Create array: [1, Model-A, 2, Model-B, 3]
    runUnprotected(() => {
      boundObject.items = [1, itemA, 2, itemB, 3]
    })

    const loroItems = loroMap.get("items") as LoroMovableList

    // Make a change that swaps models using splice (proper move operation)
    // [1, Model-A, 2, Model-B, 3] -> [1, Model-B, 2, Model-A, 3]
    runUnprotected(() => {
      // Remove both models
      const a = boundObject.items.splice(1, 1)[0] // Remove A from index 1
      const b = boundObject.items.splice(2, 1)[0] // Remove B from index 2 (was 3)
      // Re-insert in swapped positions
      boundObject.items.splice(1, 0, b) // Insert B at index 1
      boundObject.items.splice(3, 0, a) // Insert A at index 3
    })

    expect(boundObject.items.map((i) => (typeof i === "number" ? i : i.name))).toEqual([
      1,
      "B",
      2,
      "A",
      3,
    ])

    expect(loroItems.toArray().map((i) => (i instanceof LoroMap ? i.get("name") : i))).toEqual([
      1,
      "B",
      2,
      "A",
      3,
    ])

    // The primitives (1, 2, 3) should not have been touched
    // We can verify this by checking that they're still the same values
    expect(loroItems.get(0)).toBe(1)
    expect(loroItems.get(2)).toBe(2)
    expect(loroItems.get(4)).toBe(3)
  })
})
