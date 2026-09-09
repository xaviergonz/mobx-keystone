import {
  DeepChangeType,
  getSnapshot,
  idProp,
  Model,
  onDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, convertJsonToYjsData, YjsTextModel } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([
  ["move", false],
  ["insert", false],
  ["delete", false],
  ["move", true],
  ["insert", true],
  ["delete", true],
] as const)(
  "model field edits follow pending native %s operations (reentrant: %s)",
  (kind, reentrant) => {
    @testModel("pending-order-child")
    class Child extends Model({ key: idProp, count: tProp(0) }) {}
    @testModel("pending-order-root")
    class Root extends Model({
      flag: tProp(0),
      items: tProp(types.array(Child), () => [new Child({ key: "a" }), new Child({ key: "b" })]),
    }) {}
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
    autoDispose(binding.dispose)
    const list = root.get("items") as Y.Array<Y.Map<unknown>>

    const original = binding.boundObject.items.slice()
    const edited = original[kind === "delete" ? 1 : 0]
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") edited.count = 2
      })
    )
    doc.transact(() => {
      if (kind === "move") {
        list.delete(0, 1)
        list.insert(1, [convertJsonToYjsData(getSnapshot(original[0])) as Y.Map<unknown>])
      } else if (kind === "insert") {
        list.insert(0, [
          convertJsonToYjsData(getSnapshot(new Child({ key: "c" }))) as Y.Map<unknown>,
        ])
      } else list.delete(0, 1)
      runUnprotected(() => {
        if (reentrant) binding.boundObject.flag = 1
        else edited.count = 2
      })
    })
    const expected =
      kind === "move"
        ? [
            ["b", 0],
            ["a", 2],
          ]
        : kind === "insert"
          ? [
              ["c", 0],
              ["a", 2],
              ["b", 0],
            ]
          : [["b", 2]]
    expect(binding.boundObject.items.map((item) => [item.key, item.count])).toEqual(expected)
    expect(binding.boundObject.items.find((item) => item.key === edited.key)).toBe(edited)

    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)

test.each([
  ["first", false],
  ["last", false],
  ["first", true],
  ["last", true],
] as const)(
  "edits restore a deleted %s model without removing survivors (reentrant: %s)",
  (kind, reentrant) => {
    @testModel("deleted-field-child")
    class Child extends Model({ key: idProp, count: tProp(0) }) {}
    @testModel("deleted-field-root")
    class Root extends Model({
      flag: tProp(0),
      items: tProp(types.array(Child), () => ["a", "b", "c"].map((key) => new Child({ key }))),
    }) {}
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
    autoDispose(binding.dispose)
    const list = root.get("items") as Y.Array<Y.Map<unknown>>
    const original = binding.boundObject.items.slice()
    const nativeOriginal = list.toArray()

    const edited = original[kind === "first" ? 0 : 2]
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") edited.count = 2
      })
    )
    doc.transact(() => {
      if (kind === "first") list.delete(0, 1)
      else list.delete(1, 2)
      runUnprotected(() => {
        if (reentrant) binding.boundObject.flag = 1
        else edited.count = 2
      })
    })
    const expected =
      kind === "first"
        ? [
            ["a", 2],
            ["b", 0],
            ["c", 0],
          ]
        : [
            ["a", 0],
            ["c", 2],
          ]
    expect(binding.boundObject.items.map((item) => [item.key, item.count])).toEqual(expected)
    expect(binding.boundObject.items.find((item) => item.key === edited.key)).toBe(edited)
    const survivor = original[kind === "first" ? 1 : 0]
    expect(binding.boundObject.items.find((item) => item.key === survivor.key)).toBe(survivor)

    expect(list.get(kind === "first" ? 1 : 0)).toBe(nativeOriginal[kind === "first" ? 1 : 0])
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)

test.each([0, 1])(
  "edits restore deleted primitive entries with %s native survivors",
  (retained) => {
    @testModel("deleted-primitive-root")
    class Root extends Model({
      flag: tProp(0),
      values: tProp(types.array(types.number), () => [1, 2, 3]),
    }) {}
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
    const list = root.get("values") as Y.Array<number>
    autoDispose(binding.dispose)
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") {
          if (retained === 0) binding.boundObject.values[1] = 8
          binding.boundObject.values[2] = 9
        }
      })
    )
    doc.transact(() => {
      list.delete(retained, 3 - retained)
      runUnprotected(() => {
        binding.boundObject.flag = 1
      })
    })
    expect(binding.boundObject.values.slice()).toEqual(retained ? [1, 9] : [8, 9])
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)

// A native move of the first model, combined with a local field edit to that
// same model and a local positional write to the primitive next to it.
function runMixedArrayScenario(keys: readonly string[], moveTo: number, insertAt: number) {
  @testModel("mixed-array-child")
  class Child extends Model({ key: idProp, count: tProp(0) }) {}
  @testModel("mixed-array-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(types.or(Child, types.number)), () => [
      new Child({ key: keys[0] }),
      0,
      ...keys.slice(1).map((key) => new Child({ key })),
    ]),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  const list = root.get("items") as Y.Array<unknown>
  autoDispose(binding.dispose)
  const edited = binding.boundObject.items[0] as Child
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") {
        edited.count = 2
        binding.boundObject.items[1] = 1
      }
    })
  )
  doc.transact(() => {
    const snapshot = (list.get(0) as Y.Map<unknown>).toJSON()
    list.delete(0, 1)
    list.insert(moveTo, [convertJsonToYjsData(snapshot)])
    list.delete(0, 1)
    list.insert(insertAt, [0])
    runUnprotected(() => {
      binding.boundObject.flag = 1
    })
  })
  const items = binding.boundObject.items
  return {
    root,
    binding,
    edited,
    items,
    modelIds: items.filter((item): item is Child => typeof item !== "number").map((i) => i.key),
    shape: items.map((v) => (typeof v === "number" ? v : [v.key, v.count])),
  }
}

test("mixed primitive and model edits preserve pending native model order", () => {
  const { root, binding, edited, items, shape } = runMixedArrayScenario(["a", "b"], 2, 1)

  expect(shape).toEqual([["b", 0], 1, ["a", 2]])
  expect(items[2]).toBe(edited)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("mixed positional conflicts retain only one copy of an edited model", () => {
  // The local positional write lands on an index the native move filled with a
  // different model, so exact ordering cannot be preserved. What must hold is
  // that the edited model survives exactly once and no model ID is duplicated.
  const { root, binding, edited, items, modelIds } = runMixedArrayScenario(["a", "b", "c"], 3, 2)

  expect(items.filter((item) => item === edited)).toHaveLength(1)
  expect(edited.count).toBe(2)
  expect(new Set(modelIds).size).toBe(modelIds.length)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

function setup() {
  @testModel("retained-text-child")
  class Child extends Model({ key: idProp, count: tProp(0), text: tProp(YjsTextModel) }) {}
  @testModel("retained-text-root")
  class Root extends Model({
    flag: tProp(0),
    items: tProp(types.array(Child), () =>
      ["a", "b"].map((key) => new Child({ key, text: YjsTextModel.withText(key) }))
    ),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const list = root.get("items") as Y.Array<Y.Map<unknown>>
  return { doc, binding, list }
}

test("restoring a preceding model retains survivor text and relative positions", () => {
  const { doc, binding, list } = setup()
  const nativeB = list.get(1)
  const textB = nativeB.get("text") as Y.Text
  const cursor = Y.createRelativePositionFromTypeIndex(textB, 1)
  doc.transact(() => {
    list.delete(0, 1)
    textB.insert(0, "!")
    runUnprotected(() => {
      binding.boundObject.items[0].count = 2
    })
  })
  expect(list.get(1)).toBe(nativeB)
  expect(list.get(1).get("text")).toBe(textB)
  expect(binding.boundObject.items.map((item) => [item.key, item.count, item.text.text])).toEqual([
    ["a", 2, "a"],
    ["b", 0, "!b"],
  ])
  const position = Y.createAbsolutePositionFromRelativePosition(cursor, doc)
  expect(position?.type).toBe(textB)
  expect(position?.index).toBe(2)
})

test("reentrant deletion retains the following native model and text containers", () => {
  const { binding, list } = setup()
  const nativeB = list.get(1)
  const textB = nativeB.get("text") as Y.Text
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag")
        binding.boundObject.items.splice(0, 1)
    })
  )
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(list.length).toBe(1)
  expect(list.get(0)).toBe(nativeB)
  expect(list.get(0).get("text")).toBe(textB)
  expect(binding.boundObject.items[0].key).toBe("b")
  expect(binding.boundObject.items[0].text.text).toBe("b")
})
