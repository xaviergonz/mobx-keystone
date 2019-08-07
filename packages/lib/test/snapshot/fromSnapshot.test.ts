import { isObservable } from "mobx"
import { fromSnapshot, modelSnapshotInWithMetadata } from "../../src"
import "../commonSetup"
import { P, P2 } from "../testbed"

test("fromSnapshot", () => {
  const p = fromSnapshot<P>(
    modelSnapshotInWithMetadata(P, {
      arr: [1, 2, 3],
      p2: modelSnapshotInWithMetadata(P2, {
        y: 12,
      }),
    })
  )

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
          "$$metadata": Object {
            "type": "P2",
          },
        },
        "x": 5,
      },
      "$$metadata": Object {
        "type": "P",
      },
      "boundNonAction": [Function],
    }
  `)

  expect(isObservable(p)).toBeTruthy()
  expect(isObservable(p.p2!.$)).toBeTruthy()
  expect(p.p2 instanceof P2).toBeTruthy()
  expect(isObservable(p.arr)).toBeTruthy()
})
