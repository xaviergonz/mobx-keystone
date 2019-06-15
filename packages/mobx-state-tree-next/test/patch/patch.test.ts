import { applyPatches, getSnapshot, onPatches, Patch, runUnprotected } from "../../src"
import "../commonSetup"
import { createP } from "../testbed"
import { autoDispose } from "../utils"

test("onPatches and applyPatches", () => {
  const p = createP(true)
  const sn = getSnapshot(p)

  const pPatches: Patch[][] = []
  const pInvPatches: Patch[][] = []
  autoDispose(
    onPatches(p, (ptchs, iptchs) => {
      pPatches.push(ptchs)
      pInvPatches.push(iptchs)
    })
  )

  const p2Patches: Patch[][] = []
  const p2InvPatches: Patch[][] = []
  autoDispose(
    onPatches(p.data.p2!, (ptchs, iptchs) => {
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

  function expectSameSnapshotOnceReverted() {
    runUnprotected(() => {
      pInvPatches.forEach(invpatches => applyPatches(p, invpatches))
    })
    expect(getSnapshot(p)).toStrictEqual(sn)
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
                  "path": Array [
                    "x",
                  ],
                  "value": 6,
                },
              ],
              Array [
                Object {
                  "op": "replace",
                  "path": Array [
                    "p2",
                    "y",
                  ],
                  "value": 13,
                },
              ],
            ]
      `)

  expect(pInvPatches).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "op": "replace",
                  "path": Array [
                    "x",
                  ],
                  "value": 5,
                },
              ],
              Array [
                Object {
                  "op": "replace",
                  "path": Array [
                    "p2",
                    "y",
                  ],
                  "value": 12,
                },
              ],
            ]
      `)

  expect(p2Patches).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "op": "replace",
                  "path": Array [
                    "y",
                  ],
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
                  "path": Array [
                    "y",
                  ],
                  "value": 12,
                },
              ],
            ]
      `)

  expectSameSnapshotOnceReverted()

  // remove subobj
  reset()
  runUnprotected(() => {
    p.data.p2 = undefined
  })

  expect(pPatches).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "op": "replace",
                  "path": Array [
                    "p2",
                  ],
                  "value": undefined,
                },
              ],
            ]
      `)

  expect(pInvPatches).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "op": "replace",
          "path": Array [
            "p2",
          ],
          "value": Object {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P2",
            },
            "y": 12,
          },
        },
      ],
    ]
  `)

  expect(p2Patches).toMatchInlineSnapshot(`Array []`)

  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)

  expectSameSnapshotOnceReverted()

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
                  "path": Array [
                    "arr",
                  ],
                  "value": Array [
                    3,
                    2,
                    1,
                  ],
                },
              ],
            ]
      `)

  expect(pInvPatches).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "op": "replace",
                  "path": Array [
                    "arr",
                  ],
                  "value": Array [
                    1,
                    2,
                    3,
                  ],
                },
              ],
            ]
      `)

  expect(p2Patches).toMatchInlineSnapshot(`Array []`)

  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)

  expectSameSnapshotOnceReverted()
})
