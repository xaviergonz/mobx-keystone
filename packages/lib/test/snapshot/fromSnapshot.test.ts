import { isObservable } from "mobx"
import {
  fromSnapshot,
  getParentPath,
  getSnapshot,
  idProp,
  Model,
  modelSnapshotInWithMetadata,
  prop,
  runUnprotected,
} from "../../src"
import { P, P2 } from "../testbed"
import { testModel } from "../utils"

const snapshot = modelSnapshotInWithMetadata(P, {
  $modelId: "id-2",
  arr: [1, 2, 3],
  p2: modelSnapshotInWithMetadata(P2, {
    $modelId: "id-1",
    y: 12,
  }),
})

test("basic", () => {
  const p = fromSnapshot(P, snapshot)

  expect(p).toMatchInlineSnapshot(`
    P {
      "$": {
        "$modelId": "id-2",
        "arr": [
          1,
          2,
          3,
        ],
        "p2": P2 {
          "$": {
            "$modelId": "id-1",
            "y": 12,
          },
          "$modelType": "P2",
        },
        "x": 5,
      },
      "$modelType": "P",
      "boundAction": [Function],
      "boundNonAction": [Function],
    }
  `)

  expect(isObservable(p)).toBeTruthy()
  expect(isObservable(p.p2!.$)).toBeTruthy()
  expect(p.p2 instanceof P2).toBeTruthy()
  expect(isObservable(p.arr)).toBeTruthy()
})

test("plain object snapshots preserve __proto__ as data", () => {
  const sn = JSON.parse('{"obj":{"a":1,"__proto__":{"polluted":true}}}')
  const node = fromSnapshot<any>(sn)

  expect(node.obj.polluted).toBeUndefined()
  expect(Object.hasOwn(node.obj, "__proto__")).toBe(true)
  expect(Reflect.get(node.obj, "__proto__")).toStrictEqual({ polluted: true })
  expect(getSnapshot(node)).toStrictEqual(sn)
})

test("caller-owned snapshot mutation does not affect the hydrated tree", () => {
  const input = { child: { value: 1 }, values: [2, 3] }
  const node = fromSnapshot(input)

  input.child.value = 4
  input.values.push(5)

  expect(getSnapshot(node)).toStrictEqual({ child: { value: 1 }, values: [2, 3] })
})

test("scalar model snapshots remain detached from input and copy on write", () => {
  const input = modelSnapshotInWithMetadata(P2, { $modelId: "id-1", y: 12 })
  const node = fromSnapshot(P2, input)

  input.y = 13
  expect(getSnapshot(node)).toStrictEqual(
    modelSnapshotInWithMetadata(P2, { $modelId: "id-1", y: 12 })
  )

  runUnprotected(() => {
    node.y = 14
  })
  expect(getSnapshot(node)).toStrictEqual(
    modelSnapshotInWithMetadata(P2, { $modelId: "id-1", y: 14 })
  )
})

test("scalar model defaults retain their hydrated snapshot", () => {
  const node = fromSnapshot(P2, modelSnapshotInWithMetadata(P2, { $modelId: "id-1" }))

  expect(getSnapshot(node)).toStrictEqual(
    modelSnapshotInWithMetadata(P2, { $modelId: "id-1", y: 10 })
  )
})

test("generateNewIds keeps the hydrated snapshot ID in sync", () => {
  const node = fromSnapshot(
    P2,
    modelSnapshotInWithMetadata(P2, { $modelId: "snapshot-id", y: 12 }),
    { generateNewIds: true }
  )

  expect(node.$modelId).not.toBe("snapshot-id")
  expect(getSnapshot(node).$modelId).toBe(node.$modelId)
})

test("primitive defaults and regenerated IDs preserve snapshot ownership and special keys", () => {
  @testModel("PrimitiveHydrationDefaults")
  class Defaults extends Model({
    id: idProp,
    value: prop(1),
    optional: prop<string | undefined>(),
    ["__proto__"]: prop(7),
  }) {}

  const input = JSON.parse('{"id":"original","value":null,"__proto__":null}')
  const node = fromSnapshot(Defaults, input, { generateNewIds: true })
  const snapshot = getSnapshot(node)
  expect(node.id).not.toBe("original")
  expect(input.id).toBe("original")
  expect(snapshot).toStrictEqual(
    modelSnapshotInWithMetadata(Defaults, {
      id: node.id,
      value: 1,
      optional: undefined,
      ["__proto__"]: 7,
    })
  )
  expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype)
  expect(Object.hasOwn(snapshot, "__proto__")).toBe(true)

  input.id = "changed"
  input.value = 99
  Reflect.set(input, "__proto__", 42)
  expect(getSnapshot(node)).toBe(snapshot)
  expect(Reflect.get(snapshot, "__proto__")).toBe(7)
  runUnprotected(() => {
    node.value = 2
  })
  expect(snapshot.value).toBe(1)
  expect(getSnapshot(node).value).toBe(2)
})

test("object and array defaults remain tree nodes when mixed with primitive defaults", () => {
  @testModel("StructuredHydrationDefaults")
  class Defaults extends Model({
    before: prop(1),
    items: prop(() => [{ value: 2 }]),
    after: prop(3),
    object: prop(() => ({ value: 4 })),
  }) {}

  const node = fromSnapshot(Defaults, {})
  const snapshot = getSnapshot(node)
  expect(snapshot).toStrictEqual(
    modelSnapshotInWithMetadata(Defaults, {
      before: 1,
      items: [{ value: 2 }],
      after: 3,
      object: { value: 4 },
    })
  )
  expect(getParentPath(node.items[0])).toEqual({ parent: node.items, path: 0 })
  expect(getParentPath(node.object)).toEqual({ parent: node, path: "object" })
  expect(snapshot.items).not.toBe(node.items)
  expect(snapshot.object).not.toBe(node.object)
  runUnprotected(() => {
    node.items[0].value = 5
    node.object.value = 6
  })
  expect(snapshot.items[0].value).toBe(2)
  expect(snapshot.object.value).toBe(4)
  expect(getSnapshot(node).items[0].value).toBe(5)
  expect(getSnapshot(node).object.value).toBe(6)
})
