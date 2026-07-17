import { isObservable } from "mobx"
import { fromSnapshot, getSnapshot, modelSnapshotInWithMetadata, runUnprotected } from "../../src"
import { P, P2 } from "../testbed"

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
