import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { applyJsonArrayToLoroMovableList, applyJsonObjectToLoroMap } from "../../src"

test("list merge reads existing contents in bulk and observes later mutations", () => {
  const list = new LoroDoc().getMovableList("items")
  const source = Array.from({ length: 1000 }, (_, index) => index)
  applyJsonArrayToLoroMovableList(list, source)
  const get = vi.spyOn(list, "get")
  const toArray = vi.spyOn(list, "toArray")
  try {
    applyJsonArrayToLoroMovableList(list, source, { mode: "merge" })
    list.set(500, -1)
    source[20] = 2000
    applyJsonArrayToLoroMovableList(list, source, { mode: "merge" })
    expect(list.toJSON()).toEqual(source)
    expect(get.mock.calls.length).toBe(0)
    expect(toArray).toHaveBeenCalledTimes(2)
  } finally {
    get.mockRestore()
    toArray.mockRestore()
  }
})

test("map merge removes keys present only on the source prototype", () => {
  const map = new LoroDoc().getMap("root")
  map.set("inherited", 1)
  map.set("omitted", 2)
  map.set("kept", 3)
  const source = Object.assign(Object.create({ inherited: 1 }), { omitted: undefined, kept: 4 })
  applyJsonObjectToLoroMap(map, source, { mode: "merge" })
  expect(map.toJSON()).toEqual({ kept: 4 })
})

test.each([0, 1])("shrinking a list reads only its %i retained items", (length) => {
  const list = new LoroDoc().getMovableList("items")
  applyJsonArrayToLoroMovableList(
    list,
    Array.from({ length: 1000 }, (_, index) => index)
  )
  const toArray = vi.spyOn(list, "toArray")
  const source = Array.from({ length }, () => -1)
  try {
    applyJsonArrayToLoroMovableList(list, source, { mode: "merge" })
    expect(list.toJSON()).toEqual(source)
    expect(toArray.mock.calls.length).toBe(length === 0 ? 0 : 1)
    if (length > 0) expect(toArray.mock.results[0].value).toHaveLength(length)
  } finally {
    toArray.mockRestore()
  }
})

test.each(["map", "list"])("merging NaN into a %s skips redundant writes", (kind) => {
  const doc = new LoroDoc()
  if (kind === "map") {
    const map = doc.getMap("root")
    map.set("value", Number.NaN)
    const write = vi.spyOn(map, "set")
    applyJsonObjectToLoroMap(map, { value: Number.NaN }, { mode: "merge" })
    expect(write).not.toHaveBeenCalled()
  } else {
    const list = doc.getMovableList("root")
    list.push(Number.NaN)
    const write = vi.spyOn(list, "set")
    applyJsonArrayToLoroMovableList(list, [Number.NaN], { mode: "merge" })
    expect(write).not.toHaveBeenCalled()
  }
})

test("detached maps and lists support merging their readable contents", () => {
  const map = new LoroMap()
  applyJsonObjectToLoroMap(map, { removed: 1, nested: { value: 2 } })
  applyJsonObjectToLoroMap(map, { nested: { value: 3 } }, { mode: "merge" })
  expect(map.toJSON()).toEqual({ nested: { value: 3 } })
  const list = new LoroMovableList()
  applyJsonArrayToLoroMovableList(list, [1, { value: 2 }, 3])
  applyJsonArrayToLoroMovableList(list, [4, { value: 5 }], { mode: "merge" })
  expect(list.toJSON()).toEqual([4, { value: 5 }])
})
