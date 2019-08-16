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
    onPatches(p.p2!, (ptchs, iptchs) => {
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

  // no changes should result in no patches
  reset()
  runUnprotected(() => {
    p.x = p.x // eslint-disable-line no-self-assign
    p.arr[0] = p.arr[0] // eslint-disable-line no-self-assign
    p.p2!.y = p.p2!.y
  })

  expect(pPatches).toMatchInlineSnapshot(`Array []`)
  expect(pInvPatches).toMatchInlineSnapshot(`Array []`)
  expect(p2Patches).toMatchInlineSnapshot(`Array []`)
  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)

  reset()
  runUnprotected(() => {
    p.x++
    p.p2!.y++
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
    p.p2 = undefined
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
            "$modelType": "P2",
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
    p.arr = [3, 2, 1]
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

  // splice items (less items)
  reset()
  runUnprotected(() => {
    p.arr.splice(1, 2, 5) // [1, 5]
  })

  expect(pPatches).toMatchInlineSnapshot(`
                            Array [
                              Array [
                                Object {
                                  "op": "replace",
                                  "path": Array [
                                    "arr",
                                    1,
                                  ],
                                  "value": 5,
                                },
                                Object {
                                  "op": "replace",
                                  "path": Array [
                                    "arr",
                                    "length",
                                  ],
                                  "value": 2,
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
                                    1,
                                  ],
                                  "value": 2,
                                },
                                Object {
                                  "op": "add",
                                  "path": Array [
                                    "arr",
                                    2,
                                  ],
                                  "value": 3,
                                },
                              ],
                            ]
              `)

  expect(p2Patches).toMatchInlineSnapshot(`Array []`)

  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)

  expectSameSnapshotOnceReverted()

  // splice items (more items)
  reset()
  runUnprotected(() => {
    p.arr.splice(1, 2, 5, 6, 7) // [1, 5, 6, 7]
  })

  expect(pPatches).toMatchInlineSnapshot(`
                        Array [
                          Array [
                            Object {
                              "op": "replace",
                              "path": Array [
                                "arr",
                                1,
                              ],
                              "value": 5,
                            },
                            Object {
                              "op": "replace",
                              "path": Array [
                                "arr",
                                2,
                              ],
                              "value": 6,
                            },
                            Object {
                              "op": "add",
                              "path": Array [
                                "arr",
                                3,
                              ],
                              "value": 7,
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
                                1,
                              ],
                              "value": 2,
                            },
                            Object {
                              "op": "replace",
                              "path": Array [
                                "arr",
                                2,
                              ],
                              "value": 3,
                            },
                            Object {
                              "op": "replace",
                              "path": Array [
                                "arr",
                                "length",
                              ],
                              "value": 3,
                            },
                          ],
                        ]
            `)

  expect(p2Patches).toMatchInlineSnapshot(`Array []`)

  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)

  expectSameSnapshotOnceReverted()

  // splice items (same items)
  reset()
  runUnprotected(() => {
    p.arr.splice(1, 2, 5, 3) // [1, 5, 3]
  })

  expect(pPatches).toMatchInlineSnapshot(`
            Array [
              Array [
                Object {
                  "op": "replace",
                  "path": Array [
                    "arr",
                    1,
                  ],
                  "value": 5,
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
                    1,
                  ],
                  "value": 2,
                },
              ],
            ]
      `)

  expect(p2Patches).toMatchInlineSnapshot(`Array []`)

  expect(p2InvPatches).toMatchInlineSnapshot(`Array []`)

  expectSameSnapshotOnceReverted()
})
