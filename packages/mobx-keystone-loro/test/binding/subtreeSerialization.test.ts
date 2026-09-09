import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { getSnapshot, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose } from "../utils"

test("inserting a subtree reads each nested map once", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.array(types.record(types.number))),
  })
  autoDispose(dispose)
  const list = root.setContainer("items", new LoroMovableList())
  for (let i = 0; i < 100; i++) list.pushContainer(new LoroMap()).set("value", i)
  const reads = new Map<string, number>()
  const originalEntries = LoroMap.prototype.entries
  const spy = vi.spyOn(LoroMap.prototype, "entries").mockImplementation(function (this: LoroMap) {
    reads.set(this.id, (reads.get(this.id) ?? 0) + 1)
    return originalEntries.call(this)
  })
  try {
    doc.commit()
  } finally {
    spy.mockRestore()
  }
  expect(getSnapshot(boundObject)).toEqual(root.toJSON())
  expect(reads.size).toBe(100)
  expect(Math.max(...reads.values())).toBeLessThanOrEqual(1)
})

test("a 150,000-item insertion stays synchronized", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  for (let i = 0; i < 150000; i++) list.push(i)
  doc.commit()
  expect(boundObject.length).toBe(150000)
  expect(boundObject[0]).toBe(0)
  expect(boundObject[149999]).toBe(149999)
})

test("list conversion reads its container contents in bulk", async () => {
  const { convertLoroDataToJson } = await import("../../src/binding/convertLoroDataToJson")
  const list = new LoroMovableList()
  for (let i = 0; i < 1000; i++) list.push(i)
  const get = vi.spyOn(list, "get")
  try {
    expect(convertLoroDataToJson(list)).toEqual(Array.from({ length: 1000 }, (_, i) => i))
    expect(get.mock.calls.length).toBeLessThanOrEqual(1)
  } finally {
    get.mockRestore()
  }
})
