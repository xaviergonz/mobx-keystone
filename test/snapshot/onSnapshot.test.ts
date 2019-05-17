import { createP, P } from "../testbed"
import { SnapshotOf, onSnapshot, runUnprotected } from "../../src"
import { autoDispose } from "../withDisposers"

test("onSnapshot", () => {
  const p = createP()

  const sn: [SnapshotOf<P>, SnapshotOf<P>][] = []
  autoDispose(onSnapshot(p, (sn1, prevSn1) => sn.push([sn1, prevSn1])))

  runUnprotected(() => {
    p.data.x++
    p.data.p2!.data.y++
  })

  expect(sn).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "$$typeof": "P",
          "arr": Array [],
          "p2": Object {
            "$$typeof": "P2",
            "y": 13,
          },
          "x": 6,
        },
        Object {
          "$$typeof": "P",
          "arr": Array [],
          "p2": Object {
            "$$typeof": "P2",
            "y": 12,
          },
          "x": 5,
        },
      ],
    ]
  `)
})
