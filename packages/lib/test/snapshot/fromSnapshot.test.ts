import { isObservable } from "mobx"
import { fromSnapshot, modelSnapshotWithMetadata } from "../../src"
import "../commonSetup"
import { P, P2 } from "../testbed"

test("fromSnapshot", () => {
  const p = fromSnapshot<P>(
    modelSnapshotWithMetadata(
      P,
      {
        arr: [1, 2, 3],
        p2: modelSnapshotWithMetadata(
          P2,
          {
            y: 12,
          },
          "P2-id"
        ),
      },
      "P-id"
    )
  )

  expect(p).toMatchInlineSnapshot(`
    P {
      "$$metadata": Object {
        "id": "P-id",
        "type": "P",
      },
      "boundNonAction": [Function],
      "data": Object {
        "arr": Array [
          1,
          2,
          3,
        ],
        "p2": P2 {
          "$$metadata": Object {
            "id": "P2-id",
            "type": "P2",
          },
          "data": Object {
            "y": 12,
          },
        },
        "x": 5,
      },
    }
  `)

  expect(isObservable(p)).toBeTruthy()
  expect(isObservable(p.data.p2!.data)).toBeTruthy()
  expect(p.data.p2 instanceof P2).toBeTruthy()
  expect(isObservable(p.data.arr)).toBeTruthy()
})
