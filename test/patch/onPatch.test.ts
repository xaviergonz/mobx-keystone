import { createP } from "../testbed"
import { Operation } from "fast-json-patch"
import { onPatch, runUnprotected } from "../../src"
import { autoDispose } from "../withDisposers"

test("onPatch", () => {
  const p = createP()
  runUnprotected(() => {
    p.data.arr = [1, 2, 3]
  })

  const pPatches: Operation[][] = []
  const pInvPatches: Operation[][] = []
  autoDispose(
    onPatch(p, (ptchs, iptchs) => {
      pPatches.push(ptchs)
      pInvPatches.push(iptchs)
    })
  )

  const p2Patches: Operation[][] = []
  const p2InvPatches: Operation[][] = []
  autoDispose(
    onPatch(p.data.p2!, (ptchs, iptchs) => {
      p2Patches.push(ptchs)
      p2InvPatches.push(iptchs)
    })
  )

  function reset() {
    pPatches.length = 0
    pInvPatches.length = 0
    p2Patches.length = 0
    p2InvPatches.length = 0
  }

  reset()
  runUnprotected(() => {
    p.data.x++
    p.data.p2!.data.y++
  })

  expect(pPatches).toMatchInlineSnapshot(`
    Array [
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
    ]
  `)

  expect(pInvPatches).toMatchInlineSnapshot(`
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
    ]
  `)

  expect(p2Patches).toMatchInlineSnapshot(`
                    Array [
                      Array [
                        Object {
                          "op": "replace",
                          "path": "/y",
                          "value": 13,
                        },
                      ],
                    ]
          `)

  expect(p2InvPatches).toMatchInlineSnapshot(`
                Array [
                  Array [
                    Object {
                      "op": "replace",
                      "path": "/y",
                      "value": 12,
                    },
                  ],
                ]
        `)

  // remove subobj
  reset()
  runUnprotected(() => {
    p.data.p2 = undefined
  })

  expect(pPatches).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "op": "remove",
                  "path": "/p2",
                },
              ],
            ]
      `)

  expect(pInvPatches).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "op": "replace",
                  "path": "/p2",
                  "value": Object {
                    "$$typeof": "P2",
                    "y": 13,
                  },
                },
              ],
            ]
      `)

  expect(p2Patches).toMatchInlineSnapshot(`Array []`)

  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)

  // swap items around
  reset()
  runUnprotected(() => {
    p.data.arr = [3, 2, 1]
  })

  expect(pPatches).toMatchInlineSnapshot(`
        Array [
          Array [
            Object {
              "op": "replace",
              "path": "/arr/2",
              "value": 1,
            },
            Object {
              "op": "replace",
              "path": "/arr/0",
              "value": 3,
            },
          ],
        ]
    `)

  expect(pInvPatches).toMatchInlineSnapshot(`
        Array [
          Array [
            Object {
              "op": "replace",
              "path": "/arr/2",
              "value": 3,
            },
            Object {
              "op": "replace",
              "path": "/arr/0",
              "value": 1,
            },
          ],
        ]
    `)

  expect(p2Patches).toMatchInlineSnapshot(`Array []`)

  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)
})
