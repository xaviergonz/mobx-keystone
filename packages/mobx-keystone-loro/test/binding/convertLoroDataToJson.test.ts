import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { convertLoroDataToJson } from "../../src/binding/convertLoroDataToJson"
import { loroTextModelId } from "../../src/binding/LoroTextModel"

describe("convertLoroDataToJson", () => {
  test("converts primitives", () => {
    expect(convertLoroDataToJson(null)).toBe(null)
    expect(convertLoroDataToJson(42)).toBe(42)
    expect(convertLoroDataToJson("hello")).toBe("hello")
    expect(convertLoroDataToJson(true)).toBe(true)
  })

  test("throws on undefined", () => {
    expect(() => convertLoroDataToJson(undefined as any)).toThrow(
      "undefined values are not supported by Loro"
    )
  })

  test("converts LoroMap to plain object", () => {
    const doc = new LoroDoc()
    const map = doc.getMap("map")
    map.set("a", 1)
    map.set("b", "test")

    expect(convertLoroDataToJson(map)).toEqual({
      a: 1,
      b: "test",
    })
  })

  test("converts LoroMovableList to plain array", () => {
    const doc = new LoroDoc()
    const list = doc.getMovableList("list")
    list.push(1)
    list.push("test")

    expect(convertLoroDataToJson(list)).toEqual([1, "test"])
  })

  test("converts LoroText to LoroTextModel snapshot", () => {
    const doc = new LoroDoc()
    const text = doc.getText("text")
    text.insert(0, "hello")

    const result = convertLoroDataToJson(text) as any
    expect(result.$modelType).toBe(loroTextModelId)
    expect(result.deltaList.data).toEqual([{ insert: "hello" }])
  })

  test("converts nested structures", () => {
    const doc = new LoroDoc()
    const map = doc.getMap("map")
    const subMap = map.setContainer("subMap", new LoroMap())
    subMap.set("x", 10)
    const subList = map.setContainer("subList", new LoroMovableList())
    subList.push(20)

    expect(convertLoroDataToJson(map)).toEqual({
      subMap: { x: 10 },
      subList: [20],
    })
  })

  test("throws on unsupported Loro containers", () => {
    const doc = new LoroDoc()

    // LoroTree is a container that we don't support yet
    const tree = doc.getTree("tree")
    expect(() =>
      convertLoroDataToJson(
        // @ts-expect-error - testing unsupported type
        tree
      )
    ).toThrow("unsupported bindable Loro container type")

    // LoroCounter is another one
    const counter = doc.getCounter("counter")
    expect(() =>
      convertLoroDataToJson(
        // @ts-expect-error - testing unsupported type
        counter
      )
    ).toThrow("unsupported bindable Loro container type")
  })
})
