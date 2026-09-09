import { DeepChangeType } from "mobx-keystone"
import * as Y from "yjs"
import { applyJsonArrayToYArray, convertJsonToYjsData, MobxKeystoneYjsError } from "../../src"
import { applyMobxChangeToYjsObject } from "../../src/binding/applyMobxChangeToYjsObject"

test.each(["add", "merge"] as const)("%s rejects undefined before changing a list", (mode) => {
  const doc = new Y.Doc()
  const list = doc.getArray("list")
  list.push([1])
  list.push([2])
  expect(() => applyJsonArrayToYArray(list, [3, undefined], { mode })).toThrow(MobxKeystoneYjsError)
  expect(list.toArray()).toEqual([1, 2])
})

test("conversion rejects sparse arrays", () => {
  expect(() => convertJsonToYjsData(new Array(2))).toThrow(MobxKeystoneYjsError)
})

test.each(["splice", "update"])(
  "%s rejects undefined without deleting existing Yjs values",
  (kind) => {
    const doc = new Y.Doc()
    const list = doc.getArray("list")
    list.push([1])
    const common = { path: [], isInit: false, target: [1], index: 0 }
    const change =
      kind === "splice"
        ? {
            ...common,
            type: DeepChangeType.ArraySplice as const,
            removedValues: [1],
            addedValues: [undefined],
          }
        : { ...common, type: DeepChangeType.ArrayUpdate as const, oldValue: 1, newValue: undefined }
    expect(() => applyMobxChangeToYjsObject(change, list)).toThrow(MobxKeystoneYjsError)
    expect(list.toArray()).toEqual([1])
  }
)

test("a splice converts nested values before removing existing items", () => {
  const list = new Y.Doc().getArray("list")
  list.push([1])
  expect(() =>
    applyMobxChangeToYjsObject(
      {
        path: [],
        isInit: false,
        target: [1],
        index: 0,
        type: DeepChangeType.ArraySplice,
        removedValues: [1],
        addedValues: [[undefined]],
      },
      list
    )
  ).toThrow(MobxKeystoneYjsError)
  expect(list.toArray()).toEqual([1])
})
