import { isObservable } from "mobx"
import { fromSnapshot, getSnapshot, modelSnapshotInWithMetadata } from "../../src"
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
