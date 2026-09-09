import { LoroDoc } from "loro-crdt"
import { DeepChangeType } from "mobx-keystone"
import {
  applyJsonArrayToLoroMovableList,
  convertJsonToLoroData,
  MobxKeystoneLoroError,
} from "../../src"
import { applyMobxChangeToLoroObject } from "../../src/binding/applyMobxChangeToLoroObject"

test.each(["add", "merge"] as const)("%s rejects undefined before changing a list", (mode) => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("list")
  list.push(1)
  list.push(2)
  expect(() => applyJsonArrayToLoroMovableList(list, [3, undefined], { mode })).toThrow(
    MobxKeystoneLoroError
  )
  expect(list.toArray()).toEqual([1, 2])
})

test("conversion rejects sparse arrays", () => {
  expect(() => convertJsonToLoroData(new Array(2))).toThrow(MobxKeystoneLoroError)
})

test.each(["splice", "update"])(
  "%s rejects undefined without deleting existing Loro values",
  (kind) => {
    const doc = new LoroDoc()
    const list = doc.getMovableList("list")
    list.push(1)
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
    expect(() => applyMobxChangeToLoroObject(change, list)).toThrow(MobxKeystoneLoroError)
    expect(list.toArray()).toEqual([1])
  }
)

test("a splice converts nested values before removing existing items", () => {
  const list = new LoroDoc().getMovableList("list")
  list.push(1)
  expect(() =>
    applyMobxChangeToLoroObject(
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
  ).toThrow(MobxKeystoneLoroError)
  expect(list.toArray()).toEqual([1])
})
