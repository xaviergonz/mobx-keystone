import { getSnapshot, Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

/**
 * These tests verify that the Yjs binding correctly captures snapshots
 * at change time, not at apply time (which happens after the action completes).
 *
 * The critical bug scenario is: assign a value, then mutate that same value
 * within the same action. Without early snapshot capture, the CRDT would
 * receive the post-mutation state instead of the state at assignment time.
 */

@testModel("yjs-snapshot-capture-child")
class ChildModel extends Model({
  value: tProp(types.number, 0),
}) {}

@testModel("yjs-snapshot-capture-parent")
class ParentModel extends Model({
  items: tProp(types.array(ChildModel), () => []),
}) {}

describe("snapshot capture timing", () => {
  /**
   * Helper to create a bound model and verify sync.
   */
  function setup() {
    const doc = new Y.Doc()
    const yRootMap = doc.getMap("testModel")

    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: yRootMap,
      mobxKeystoneType: ParentModel,
    })
    autoDispose(dispose)

    const expectInSync = () => {
      expect(getSnapshot(boundObject)).toEqual(yRootMap.toJSON())
    }

    return { doc, yRootMap, boundObject, expectInSync }
  }

  /**
   * CRITICAL TEST: This is the bug scenario that requires early snapshot capture.
   *
   * When you assign an array and then mutate it in the same action, the CRDT
   * must capture the array state at assignment time. Without this, the
   * ObjectUpdate change would see the post-mutation array state.
   */
  test("assign array then mutate it - captures state at assignment time", () => {
    const { boundObject, yRootMap, expectInSync } = setup()

    runUnprotected(() => {
      const itemA = new ChildModel({ value: 1 })
      // Assign the array [A, B]
      boundObject.items = [itemA, new ChildModel({ value: 2 })]
      // Then mutate it: [A, B] -> [B] -> [B, A]
      boundObject.items.splice(0, 1)
      boundObject.items.push(itemA)
    })

    // Final state should be [B, A] which is [value:2, value:1]
    expect(boundObject.items.map((i) => i.value)).toEqual([2, 1])

    // Yjs must match
    const yItems = yRootMap.get("items") as Y.Array<Y.Map<any>>
    expect(yItems.toArray().map((m) => m.get("value"))).toEqual([2, 1])

    expectInSync()
  })

  /**
   * Edge case: similar issue with object property assignment followed by mutation.
   */
  test("assign object property then mutate the array property - captures state at assignment time", () => {
    const { boundObject, yRootMap, expectInSync } = setup()

    runUnprotected(() => {
      const itemA = new ChildModel({ value: 1 })
      const itemB = new ChildModel({ value: 2 })
      // Assign with [A, B]
      boundObject.items = [itemA, itemB]
      // Swap order: [A, B] -> [B, A]
      boundObject.items.splice(0, 2, itemB, itemA)
    })

    expect(boundObject.items.map((i) => i.value)).toEqual([2, 1])

    const yItems = yRootMap.get("items") as Y.Array<Y.Map<any>>
    expect(yItems.toArray().map((m) => m.get("value"))).toEqual([2, 1])

    expectInSync()
  })
})
