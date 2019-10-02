import { isObservable } from "mobx"
import { fromSnapshot, modelSnapshotInWithMetadata } from "../../src"
import "../commonSetup"
import { P, P2 } from "../testbed"

const snapshot = modelSnapshotInWithMetadata(P, {
  arr: [1, 2, 3],
  p2: modelSnapshotInWithMetadata(P2, {
    y: 12,
  }),
})

test("basic", () => {
  const p = fromSnapshot<P>(snapshot)

  expect(p).toMatchInlineSnapshot(`
        P {
          "$": Object {
            "arr": Array [
              1,
              2,
              3,
            ],
            "p2": P2 {
              "$": Object {
                "y": 12,
              },
              "$modelId": "id-1",
              "$modelType": "P2",
            },
            "x": 5,
          },
          "$modelId": "id-2",
          "$modelType": "P",
          "boundNonAction": [Function],
        }
    `)

  expect(isObservable(p)).toBeTruthy()
  expect(isObservable(p.p2!.$)).toBeTruthy()
  expect(p.p2 instanceof P2).toBeTruthy()
  expect(isObservable(p.arr)).toBeTruthy()
})

test("with override and generate new ids", () => {
  const p = fromSnapshot<P>(snapshot, {
    generateNewIds: true,
    overrideRootModelId: "ROOT_ID",
  })

  expect(p).toMatchInlineSnapshot(`
    P {
      "$": Object {
        "arr": Array [
          1,
          2,
          3,
        ],
        "p2": P2 {
          "$": Object {
            "y": 12,
          },
          "$modelId": "id-3",
          "$modelType": "P2",
        },
        "x": 5,
      },
      "$modelId": "ROOT_ID",
      "$modelType": "P",
      "boundNonAction": [Function],
    }
  `)
})

test("with override and without generate new ids", () => {
  const p = fromSnapshot<P>(snapshot, {
    generateNewIds: false,
    overrideRootModelId: "ROOT_ID",
  })

  expect(p).toMatchInlineSnapshot(`
    P {
      "$": Object {
        "arr": Array [
          1,
          2,
          3,
        ],
        "p2": P2 {
          "$": Object {
            "y": 12,
          },
          "$modelId": "id-1",
          "$modelType": "P2",
        },
        "x": 5,
      },
      "$modelId": "ROOT_ID",
      "$modelType": "P",
      "boundNonAction": [Function],
    }
  `)
})
