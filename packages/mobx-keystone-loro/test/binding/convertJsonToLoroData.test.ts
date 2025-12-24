import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { Model, toFrozenSnapshot, tProp, types } from "mobx-keystone"
import {
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  convertJsonToLoroData,
} from "../../src"
import { loroTextModelId } from "../../src/binding/LoroTextModel"
import { testModel } from "../utils"

describe("convertJsonToLoroData", () => {
  test.each([
    [null, null],
    [undefined, undefined],
    [42, 42],
    ["hello", "hello"],
    [true, true],
  ])("converts primitive %p", (input, expected) => {
    expect(convertJsonToLoroData(input)).toBe(expected)
  })

  test("converts nested structures (arrays and objects)", () => {
    const input = {
      name: "root",
      items: [1, 2, 3],
      nested: { value: 42 },
      emptyArr: [],
      emptyObj: {},
    }
    const result = convertJsonToLoroData(input) as LoroMap

    expect(result).toBeInstanceOf(LoroMap)
    expect(result.toJSON()).toEqual(input)
  })

  test("preserves frozen values", () => {
    const frozenData = toFrozenSnapshot({ some: "data", nested: { value: 123 } })
    expect(convertJsonToLoroData(frozenData)).toEqual(frozenData)
  })

  test("converts LoroTextModel snapshot to LoroText (with formatting)", () => {
    const deltaList = [
      { insert: "Bold", attributes: { bold: true } },
      { insert: " and " },
      { insert: "italic", attributes: { italic: true } },
    ]
    const textModelSnapshot = {
      $modelType: loroTextModelId,
      $modelId: "text-2",
      deltaList: toFrozenSnapshot(deltaList),
    }

    const result = convertJsonToLoroData(textModelSnapshot) as LoroText
    expect(result).toBeInstanceOf(LoroText)
    expect(result.toString()).toBe("Bold and italic")
    expect(result.toDelta()).toEqual(deltaList)
  })

  test("throws on unsupported types", () => {
    // @ts-expect-error - testing unsupported type
    expect(() => convertJsonToLoroData(() => {})).toThrow("unsupported value type")
  })
})

describe("apply helpers", () => {
  test("applyJsonArrayToLoroMovableList", () => {
    const list = new LoroMovableList()
    const input = [1, "hello", { a: 2 }, [3, 4], null]
    applyJsonArrayToLoroMovableList(list, input)
    expect(list.toJSON()).toEqual(input)
  })

  test("applyJsonObjectToLoroMap", () => {
    const map = new LoroMap()
    const input = {
      num: 42,
      str: "hello",
      bool: true,
      obj: { x: 1 },
      arr: [1, 2],
      nil: null,
    }
    applyJsonObjectToLoroMap(map, input)
    expect(map.toJSON()).toEqual(input)
  })
})

describe("integration with models", () => {
  @testModel("ConvertJsonTest/TodoItem")
  class TodoItem extends Model({
    text: tProp(types.string),
    done: tProp(types.boolean, false),
  }) {}

  @testModel("ConvertJsonTest/TodoList")
  // biome-ignore lint/correctness/noUnusedVariables: register model type
  class TodoList extends Model({
    title: tProp(types.string),
    items: tProp(types.array(types.model(TodoItem)), () => []),
    metadata: tProp(types.frozen(types.unchecked<{ created: string }>())),
  }) {}

  TodoList // to avoid unused variable lint error

  test("converts model snapshot to Loro structure", () => {
    const snapshot = {
      $modelType: "ConvertJsonTest/TodoList",
      $modelId: "list-1",
      title: "My List",
      items: [
        {
          $modelType: "ConvertJsonTest/TodoItem",
          $modelId: "item-1",
          text: "First",
          done: false,
        },
        {
          $modelType: "ConvertJsonTest/TodoItem",
          $modelId: "item-2",
          text: "Second",
          done: true,
        },
      ],
      metadata: toFrozenSnapshot({ created: "2025-01-01" }),
    }

    const result = convertJsonToLoroData(snapshot) as LoroMap
    expect(result).toBeInstanceOf(LoroMap)
    expect(result.toJSON()).toEqual(snapshot)
  })

  test("converts LoroTextModel snapshot to LoroText", () => {
    const deltaList = [{ insert: "Hello ", attributes: { bold: true } }, { insert: "World" }]
    const snapshot = {
      $modelType: loroTextModelId,
      $modelId: "text-1",
      deltaList: toFrozenSnapshot(deltaList),
    }

    const result = convertJsonToLoroData(snapshot) as LoroText
    expect(result).toBeInstanceOf(LoroText)
    expect(result.toString()).toBe("Hello World")
    expect(result.toDelta()).toEqual(deltaList)
  })
})
