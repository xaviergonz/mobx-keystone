import { assert, _ } from "spec.ts"
import {
  applySnapshot,
  clone,
  getSnapshot,
  Model,
  ModelMetadata,
  onPatches,
  onSnapshot,
  Patch,
  runUnprotected,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
import "../commonSetup"
import { createP, P, P2 } from "../testbed"
import { autoDispose } from "../utils"

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
    p.$.arr.push(1, 2, 3)
    p.$.x++
    p.$.p2!.$.y++
  })

  expect(sn).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "$$metadata": Object {
            "id": "mockedUuid-2",
            "type": "P",
          },
          "arr": Array [
            1,
            2,
            3,
          ],
          "p2": Object {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
            "y": 13,
          },
          "x": 6,
        },
        Object {
          "$$metadata": Object {
            "id": "mockedUuid-2",
            "type": "P",
          },
          "arr": Array [],
          "p2": Object {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
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
          "$$metadata": Object {
            "id": "mockedUuid-2",
            "type": "P",
          },
          "arr": Array [],
          "p2": Object {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
            "y": 12,
          },
          "x": 5,
        },
        Object {
          "$$metadata": Object {
            "id": "mockedUuid-2",
            "type": "P",
          },
          "arr": Array [
            1,
            2,
            3,
          ],
          "p2": Object {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P2",
            },
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
    ]
  `)
})

test("applySnapshot can create a new submodel", () => {
  const p = createP()
  const originalSn = getSnapshot(p)

  runUnprotected(() => {
    p.$.x++
    p.$.p2 = undefined
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
  expect(p.$.p2 instanceof Model).toBe(true)

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
              "$$metadata": Object {
                "id": "mockedUuid-3",
                "type": "P2",
              },
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
    ]
  `)

  // swap the model for a clone, it should still be patched and create a snapshot,
  // but it should have a different id
  reset()
  const oldP2 = p.$.p2!
  runUnprotected(() => {
    p.$.p2 = clone(oldP2)
  })
  expect(p.$.p2).not.toBe(oldP2)
  expect(p.$.p2 instanceof Model).toBe(true)
  expect(getSnapshot(p.$.p2)).not.toBe(getSnapshot(oldP2))

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
              "$$metadata": Object {
                "id": "mockedUuid-5",
                "type": "P2",
              },
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
              "$$metadata": Object {
                "id": "mockedUuid-3",
                "type": "P2",
              },
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
          "$$metadata": Object {
            "id": "mockedUuid-4",
            "type": "P",
          },
          "arr": Array [],
          "p2": Object {
            "$$metadata": Object {
              "id": "mockedUuid-5",
              "type": "P2",
            },
            "y": 12,
          },
          "x": 5,
        },
        Object {
          "$$metadata": Object {
            "id": "mockedUuid-4",
            "type": "P",
          },
          "arr": Array [],
          "p2": Object {
            "$$metadata": Object {
              "id": "mockedUuid-3",
              "type": "P2",
            },
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
      p.$.arr.push(undefined as any)
    })
  ).toThrow("undefined is not supported inside arrays")
  expect(p.$.arr.length).toBe(0)

  runUnprotected(() => {
    p.$.arr.push(null as any)
  })
  expect(p.$.arr).toEqual([null])
})

test("types", () => {
  assert(
    _ as SnapshotInOf<P2>,
    _ as ({
      y?: number
    } & {
      $$metadata: ModelMetadata
    })
  )

  assert(
    _ as SnapshotOutOf<P2>,
    _ as ({
      y: number
    } & {
      $$metadata: ModelMetadata
    })
  )

  assert(
    _ as SnapshotInOf<P>,
    _ as ({
      x?: number
      arr?: number[]
      p2?: SnapshotInOf<P2>
    } & {
      $$metadata: ModelMetadata
    })
  )

  assert(
    _ as SnapshotOutOf<P>,
    _ as ({
      x: number
      arr: number[]
      p2?: SnapshotOutOf<P2>
    } & {
      $$metadata: ModelMetadata
    })
  )
})
