import { isObservable } from "mobx"
import { fromSnapshot, typeofKey } from "../src"
import { P, P2 } from "./testbed"

test("fromSnapshot", () => {
  const p = fromSnapshot<P>({
    [typeofKey]: "P",
    arr: [1, 2, 3],
    p2: {
      [typeofKey]: "P2",
      y: 12,
    },
  })

  expect(p).toMatchInlineSnapshot(`
    P {
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
