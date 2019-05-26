import { createP, P } from "../testbed"
import {
  SnapshotOutOf,
  onSnapshot,
  runUnprotected,
  getSnapshot,
  applySnapshot,
  PatchOperation,
  onPatches,
  Model,
} from "../../src"
import { autoDispose } from "../withDisposers"

test("onSnapshot and applySnapshot", () => {
  const p = createP()

  const sn: [SnapshotOutOf<P>, SnapshotOutOf<P>][] = []
  const patches: [PatchOperation[], PatchOperation[]][] = []

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
          "$$typeof": "P",
          "arr": Array [
            1,
            2,
            3,
          ],
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
          "arr": Array [
            1,
            2,
            3,
          ],
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
            "op": "remove",
            "path": "/arr/2",
          },
          Object {
            "op": "remove",
            "path": "/arr/1",
          },
          Object {
            "op": "remove",
            "path": "/arr/0",
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
            "op": "add",
            "path": "/arr/0",
            "value": 1,
          },
          Object {
            "op": "add",
            "path": "/arr/1",
            "value": 2,
          },
          Object {
            "op": "add",
            "path": "/arr/2",
            "value": 3,
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
  expect(p.data.p2 instanceof Model).toBe(true)

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
