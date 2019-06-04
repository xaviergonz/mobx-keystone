import { isObservable } from "mobx"
import { fromSnapshot, modelIdKey, typeofKey } from "../../src"
import "../commonSetup"
import { P, P2 } from "../testbed"

test("fromSnapshot", () => {
  const p = fromSnapshot<P>({
    [typeofKey]: "P",
    [modelIdKey]: "P-id",
    arr: [1, 2, 3],
    p2: {
      [typeofKey]: "P2",
      [modelIdKey]: "P2-id",
      y: 12,
    },
  })

  expect(p).toMatchInlineSnapshot(`
    P {
      "$$id": "P-id",
      "$$typeof": "P",
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
          "$$id": "P2-id",
          "$$typeof": "P2",
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
