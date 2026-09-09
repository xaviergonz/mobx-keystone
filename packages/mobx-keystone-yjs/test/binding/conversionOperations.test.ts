import { spy } from "mobx"
import { types } from "mobx-keystone"
import * as Y from "yjs"
import {
  applyJsonArrayToYArray,
  applyJsonObjectToYMap,
  bindYjsToMobxKeystone,
  convertJsonToYjsData,
} from "../../src"
import { applyYjsEventsToSnapshot } from "../../src/binding/applyYjsEventsToSnapshot"
import { convertYjsDataToJson } from "../../src/binding/convertYjsDataToJson"
import { autoDispose } from "../utils"

test.each(["add", "merge"] as const)("array %s publishes one atomic update", (mode) => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  array.push([99, 98])
  const states: number[][] = []
  array.observe(() => states.push(array.toArray()))
  applyJsonArrayToYArray(array, [1, 2, 3, 4], { mode })
  const expected = mode === "add" ? [99, 98, 1, 2, 3, 4] : [1, 2, 3, 4]
  expect(states).toEqual([expected])
})

test.each(["add", "merge"] as const)("map %s publishes one atomic update", (mode) => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const states: unknown[] = []
  map.observeDeep(() => states.push(map.toJSON()))
  applyJsonObjectToYMap(map, { first: 1, nested: { second: 2 }, third: [3, 4] }, { mode })
  expect(states).toEqual([{ first: 1, nested: { second: 2 }, third: [3, 4] }])
})

test("large JSON arrays convert without exceeding the argument limit", () => {
  const source = Array.from({ length: 150_000 }, (_, i) => i)
  const doc = new Y.Doc()
  const array = convertJsonToYjsData(source) as Y.Array<number>
  doc.getMap("root").set("array", array)
  expect(array.length).toBe(source.length)
  expect(array.get(source.length - 1)).toBe(source.length - 1)
})

test("large native array insertions synchronize without exceeding the argument limit", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  array.push(Array.from({ length: 150_000 }, (_, i) => i))
  expect(boundObject.length).toBe(150_000)
  expect(boundObject[149_999]).toBe(149_999)
})

test("snapshot construction does not mutate or repeatedly enumerate its input", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const snapshot = { a: [1, 2], b: [3, 4], c: [5, 6] }
  applyJsonObjectToYMap(map, snapshot)
  const enumerate = vi.fn(Reflect.ownKeys)
  const trackedSnapshot = new Proxy(snapshot, { ownKeys: enumerate })
  let result: unknown
  map.observeDeep((events) => {
    result = applyYjsEventsToSnapshot(trackedSnapshot, events, 0)
  })
  doc.transact(() => {
    for (const key of ["a", "b", "c"]) {
      ;(map.get(key) as Y.Array<number>).delete(0, 1)
    }
  })
  expect(result).toEqual({ a: [2], b: [4], c: [6] })
  expect(snapshot).toEqual({ a: [1, 2], b: [3, 4], c: [5, 6] })
  expect(enumerate).toHaveBeenCalledTimes(1)
})

test("converting a primitive array uses one MobX action", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  array.push(Array.from({ length: 1000 }, (_, i) => i))
  let actions = 0
  const stop = spy((event) => {
    if (event.type === "action") actions++
  })
  let snapshot: unknown
  try {
    snapshot = convertYjsDataToJson(array)
  } finally {
    stop()
  }
  expect(snapshot).toEqual(array.toArray())
  expect(actions).toBe(1)
})
