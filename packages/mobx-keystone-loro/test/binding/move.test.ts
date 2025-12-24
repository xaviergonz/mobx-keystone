import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { idProp, Model, model, prop, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose } from "../utils"

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
})
