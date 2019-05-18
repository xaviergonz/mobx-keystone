import { createP, P } from "../testbed"
import {
  SnapshotOf,
  onSnapshot,
  runUnprotected,
  getSnapshot,
  applySnapshot,
  PatchOperation,
  onPatches,
} from "../../src"
import { autoDispose } from "../withDisposers"

test("onSnapshot and applySnapshot", () => {
  const p = createP()

  const sn: [SnapshotOf<P>, SnapshotOf<P>][] = []
  autoDispose(onSnapshot(p, (sn1, prevSn1) => sn.push([sn1, prevSn1])))

  const originalSn = getSnapshot(p)

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

  sn.length = 0
  const patches: [PatchOperation[], PatchOperation[]][] = []
  autoDispose(
    onPatches(p, (pa, invPa) => {
      patches.push([pa, invPa])
    })
  )
  runUnprotected(() => {
    applySnapshot(p, originalSn)
  })
  expect(getSnapshot(p)).toStrictEqual(originalSn)

  expect(sn).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "$$typeof": "P",
                  "arr": Array [],
                  "p2": Object {
                    "$$typeof": "P2",
                    "y": 12,
                  },
                  "x": 5,
                },
                Object {
                  "$$typeof": "P",
                  "arr": Array [],
                  "p2": Object {
                    "$$typeof": "P2",
                    "y": 13,
                  },
                  "x": 6,
                },
              ],
            ]
      `)

  expect(patches).toMatchInlineSnapshot(`
        Array [
          Array [
            Array [
              Object {
                "op": "replace",
                "path": "/p2/y",
                "value": 12,
              },
              Object {
                "op": "replace",
                "path": "/x",
                "value": 5,
              },
            ],
            Array [
              Object {
                "op": "replace",
                "path": "/p2/y",
                "value": 13,
              },
              Object {
                "op": "replace",
                "path": "/x",
                "value": 6,
              },
            ],
          ],
        ]
    `)
})

test("applySnapshot can create a new submodel", () => {
  const p = createP()
  const originalSn = getSnapshot(p)

  runUnprotected(() => {
    p.data.x++
    p.data.p2 = undefined
  })

  const patches: [PatchOperation[], PatchOperation[]][] = []
  autoDispose(
    onPatches(p, (pa, invPa) => {
      patches.push([pa, invPa])
    })
  )
  runUnprotected(() => {
    applySnapshot(p, originalSn)
  })
  expect(getSnapshot(p)).toStrictEqual(originalSn)

  expect(patches).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Object {
            "op": "replace",
            "path": "/p2",
            "value": Object {
              "$$typeof": "P2",
              "y": 12,
            },
          },
          Object {
            "op": "replace",
            "path": "/x",
            "value": 5,
          },
        ],
        Array [
          Object {
            "op": "remove",
            "path": "/p2",
          },
          Object {
            "op": "replace",
            "path": "/x",
            "value": 6,
          },
        ],
      ],
    ]
  `)
})
