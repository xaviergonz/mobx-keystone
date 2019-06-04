import {
  applySnapshot,
  clone,
  getSnapshot,
  Model,
  onPatches,
  onSnapshot,
  Patch,
  runUnprotected,
  SnapshotOutOf,
} from "../../src"
import "../commonSetup"
import { createP, P } from "../testbed"
import { autoDispose } from "../withDisposers"

test("onSnapshot and applySnapshot", () => {
  const p = createP()

  const sn: [SnapshotOutOf<P>, SnapshotOutOf<P>][] = []
  const patches: [Patch[], Patch[]][] = []

  function reset() {
    sn.length = 0
    patches.length = 0
  }

  autoDispose(onSnapshot(p, (sn1, prevSn1) => sn.push([sn1, prevSn1])))

  const originalSn = getSnapshot(p)

  runUnprotected(() => {
    p.data.arr.push(1, 2, 3)
    p.data.x++
    p.data.p2!.data.y++
  })

  expect(sn).toMatchInlineSnapshot(`
        Array [
          Array [
            Object {
              "$$id": "mockedUuid-1",
              "$$typeof": "P",
              "arr": Array [
                1,
                2,
                3,
              ],
              "p2": Object {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "y": 13,
              },
              "x": 6,
            },
            Object {
              "$$id": "mockedUuid-1",
              "$$typeof": "P",
              "arr": Array [],
              "p2": Object {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "y": 12,
              },
              "x": 5,
            },
          ],
        ]
    `)

  reset()
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
              "$$id": "mockedUuid-1",
              "$$typeof": "P",
              "arr": Array [],
              "p2": Object {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "y": 12,
              },
              "x": 5,
            },
            Object {
              "$$id": "mockedUuid-1",
              "$$typeof": "P",
              "arr": Array [
                1,
                2,
                3,
              ],
              "p2": Object {
                "$$id": "mockedUuid-2",
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
                      "x",
                    ],
                    "value": 6,
                  },
                ],
              ],
              Array [
                Array [
                  Object {
                    "op": "replace",
                    "path": Array [
                      "arr",
                      "length",
                    ],
                    "value": 0,
                  },
                ],
                Array [
                  Object {
                    "op": "add",
                    "path": Array [
                      "arr",
                      0,
                    ],
                    "value": 1,
                  },
                  Object {
                    "op": "add",
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
              ],
              Array [
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

  const sn: [SnapshotOutOf<P>, SnapshotOutOf<P>][] = []
  const patches: [Patch[], Patch[]][] = []

  function reset() {
    sn.length = 0
    patches.length = 0
  }

  autoDispose(onSnapshot(p, (sn1, prevSn1) => sn.push([sn1, prevSn1])))

  autoDispose(
    onPatches(p, (pa, invPa) => {
      patches.push([pa, invPa])
    })
  )

  reset()
  runUnprotected(() => {
    applySnapshot(p, originalSn)
  })
  expect(getSnapshot(p)).toStrictEqual(originalSn)
  expect(p.data.p2 instanceof Model).toBe(true)

  expect(patches).toMatchInlineSnapshot(`
        Array [
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
                  "x",
                ],
                "value": 6,
              },
            ],
          ],
          Array [
            Array [
              Object {
                "op": "replace",
                "path": Array [
                  "p2",
                ],
                "value": Object {
                  "$$id": "mockedUuid-4",
                  "$$typeof": "P2",
                  "y": 12,
                },
              },
            ],
            Array [
              Object {
                "op": "replace",
                "path": Array [
                  "p2",
                ],
                "value": undefined,
              },
            ],
          ],
        ]
    `)

  // swap the model for a clone, it should still be patched and create a snapshot,
  // but it should have a different id
  reset()
  const oldP2 = p.data.p2!
  runUnprotected(() => {
    p.data.p2 = clone(oldP2)
  })
  expect(p.data.p2).not.toBe(oldP2)
  expect(p.data.p2 instanceof Model).toBe(true)
  expect(getSnapshot(p.data.p2)).not.toBe(getSnapshot(oldP2))

  expect(patches).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Object {
            "op": "replace",
            "path": Array [
              "p2",
            ],
            "value": Object {
              "$$id": "mockedUuid-5",
              "$$typeof": "P2",
              "y": 12,
            },
          },
        ],
        Array [
          Object {
            "op": "replace",
            "path": Array [
              "p2",
            ],
            "value": Object {
              "$$id": "mockedUuid-4",
              "$$typeof": "P2",
              "y": 12,
            },
          },
        ],
      ],
    ]
  `)

  expect(sn).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "$$id": "mockedUuid-3",
          "$$typeof": "P",
          "arr": Array [],
          "p2": Object {
            "$$id": "mockedUuid-5",
            "$$typeof": "P2",
            "y": 12,
          },
          "x": 5,
        },
        Object {
          "$$id": "mockedUuid-3",
          "$$typeof": "P",
          "arr": Array [],
          "p2": Object {
            "$$id": "mockedUuid-4",
            "$$typeof": "P2",
            "y": 12,
          },
          "x": 5,
        },
      ],
    ]
  `)
})

test("undefined should not be allowed in arrays, but null should", () => {
  const p = createP()

  expect(() =>
    runUnprotected(() => {
      p.data.arr.push(undefined as any)
    })
  ).toThrow("undefined is not supported inside arrays")
  expect(p.data.arr.length).toBe(0)

  runUnprotected(() => {
    p.data.arr.push(null as any)
  })
  expect(p.data.arr).toEqual([null])
})
