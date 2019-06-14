import { isObservable } from "mobx"
import { fromSnapshot, modelMetadataKey } from "../../src"
import "../commonSetup"
import { P, P2 } from "../testbed"

test("fromSnapshot", () => {
  const p = fromSnapshot<P>({
    [modelMetadataKey]: {
      type: "P",
      id: "P-id",
    },
    arr: [1, 2, 3],
    p2: {
      [modelMetadataKey]: {
        type: "P2",
        id: "P2-id",
      },
      y: 12,
    },
  })

  expect(p).toMatchInlineSnapshot(`
    P {
      "$$metadata": Object {
        "id": "P-id",
        "type": "P",
      },
      "IAMPRIVATE": -2,
      "IAMPROTECTED": 2,
      "IAMPUBLIC": 5,
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
