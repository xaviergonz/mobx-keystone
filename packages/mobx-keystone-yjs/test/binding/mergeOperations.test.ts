import * as Y from "yjs"
import { applyJsonArrayToYArray, applyJsonObjectToYMap } from "../../src"
import { autoDispose } from "../utils"

test("merging a map enumerates its source only once", () => {
  const map = new Y.Doc().getMap("root")
  const source = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [String(i), i]))
  applyJsonObjectToYMap(map, source)
  const enumerate = vi.fn(Reflect.ownKeys)
  const trackedSource = new Proxy<Record<string, number>>(source, { ownKeys: enumerate })
  applyJsonObjectToYMap(map, trackedSource, { mode: "merge" })
  expect(map.toJSON()).toEqual(source)
  expect(enumerate).toHaveBeenCalledTimes(1)
})

test("merging unchanged shared arrays traverses their items linearly", () => {
  const array = new Y.Doc().getArray("root")
  const source = Array.from({ length: 200 }, () => ({}))
  applyJsonArrayToYArray(array, source)
  const retained = array.toArray()
  const update = vi.fn()
  array.doc!.on("update", update)
  let traversals = 0
  const restore: (() => void)[] = []
  for (let item = array._start; item; ) {
    const current = item
    const next = current.right
    const descriptor = Object.getOwnPropertyDescriptor(current, "right")!
    Object.defineProperty(current, "right", {
      configurable: true,
      get() {
        traversals++
        return next
      },
    })
    restore.push(() => Object.defineProperty(current, "right", descriptor))
    item = next
  }
  try {
    applyJsonArrayToYArray(array, source, { mode: "merge" })
  } finally {
    for (const reset of restore) reset()
  }
  expect(array.toJSON()).toEqual(source)
  expect(array.toArray().every((item, index) => item === retained[index])).toBe(true)
  expect(update).not.toHaveBeenCalled()
  expect(traversals).toBeLessThan(source.length * 10)
})

test.each([200, 20_000])("array merge batches %s adjacent replacements", (length) => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  const initial = Array.from({ length }, (_, i) => i)
  const replacement = initial.map((value) => value + length)
  applyJsonArrayToYArray(array, initial)
  const undo = new Y.UndoManager(array)
  autoDispose(() => undo.destroy())
  const remove = vi.spyOn(array, "delete")
  const insert = vi.spyOn(array, "insert")
  try {
    applyJsonArrayToYArray(array, replacement, { mode: "merge" })
    expect(array.toArray()).toEqual(replacement)
    expect(remove).toHaveBeenCalledTimes(Math.ceil(length / 8192))
    expect(insert).toHaveBeenCalledTimes(Math.ceil(length / 8192))
  } finally {
    remove.mockRestore()
    insert.mockRestore()
  }
  undo.undo()
  expect(array.toArray()).toEqual(initial)
  undo.redo()
  expect(array.toArray()).toEqual(replacement)
})

test("array merge replacement batches preserve intervening containers and values", () => {
  const doc = new Y.Doc()
  const array = doc.getArray("root")
  applyJsonArrayToYArray(array, [1, 2, { value: 1 }, 3, 4, [1], 5, 6, "kept", 7, 8])
  const retainedMap = array.get(2)
  const retainedArray = array.get(5)
  const replacement = [11, 12, { value: 2 }, 13, 14, [2], 15, 16, "kept", 17, 18]
  const insert = vi.spyOn(array, "insert")
  try {
    applyJsonArrayToYArray(array, replacement, { mode: "merge" })
    expect(array.toJSON()).toEqual(replacement)
    expect(array.get(2)).toBe(retainedMap)
    expect(array.get(5)).toBe(retainedArray)
    expect(insert.mock.calls.map(([index, values]) => [index, values.length])).toEqual([
      [0, 2],
      [3, 2],
      [6, 2],
      [9, 2],
    ])
  } finally {
    insert.mockRestore()
  }
  const remote = new Y.Doc()
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
  expect(remote.getArray("root").toJSON()).toEqual(replacement)
  remote.destroy()
})
