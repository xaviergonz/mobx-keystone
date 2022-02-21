import { toJS } from "mobx"
import { assert, _ } from "spec.ts"
import {
  applySnapshot,
  ArraySet,
  BaseModel,
  clone,
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  model,
  modelAction,
  modelIdKey,
  modelSnapshotOutWithMetadata,
  modelTypeKey,
  ObjectMap,
  onPatches,
  onSnapshot,
  Patch,
  prop,
  runUnprotected,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
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
    p.arr.push(1, 2, 3)
    p.x++
    p.p2!.y++
  })

  expect(sn).toMatchInlineSnapshot(`
        Array [
          Array [
            Object {
              "$modelId": "id-2",
              "$modelType": "P",
              "arr": Array [
                1,
                2,
                3,
              ],
              "p2": Object {
                "$modelId": "id-1",
                "$modelType": "P2",
                "y": 13,
              },
              "x": 6,
            },
            Object {
              "$modelId": "id-2",
              "$modelType": "P",
              "arr": Array [],
              "p2": Object {
                "$modelId": "id-1",
                "$modelType": "P2",
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
              "$modelId": "id-2",
              "$modelType": "P",
              "arr": Array [],
              "p2": Object {
                "$modelId": "id-1",
                "$modelType": "P2",
                "y": 12,
              },
              "x": 5,
            },
            Object {
              "$modelId": "id-2",
              "$modelType": "P",
              "arr": Array [
                1,
                2,
                3,
              ],
              "p2": Object {
                "$modelId": "id-1",
                "$modelType": "P2",
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
              2,
            ],
            "value": 3,
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
              0,
            ],
            "value": 1,
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
    p.x++
    p.p2 = undefined
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
  expect(p.p2 instanceof BaseModel).toBe(true)

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
              "$modelId": "id-1",
              "$modelType": "P2",
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
  let oldP2 = p.p2!
  runUnprotected(() => {
    p.p2 = clone(oldP2)
  })
  expect(p.p2).not.toBe(oldP2)
  expect(p.p2 instanceof BaseModel).toBe(true)
  expect(getSnapshot(p.p2)).not.toBe(getSnapshot(oldP2))

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
              "$modelId": "id-3",
              "$modelType": "P2",
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
              "$modelId": "id-1",
              "$modelType": "P2",
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
          "$modelId": "id-2",
          "$modelType": "P",
          "arr": Array [],
          "p2": Object {
            "$modelId": "id-3",
            "$modelType": "P2",
            "y": 12,
          },
          "x": 5,
        },
        Object {
          "$modelId": "id-2",
          "$modelType": "P",
          "arr": Array [],
          "p2": Object {
            "$modelId": "id-1",
            "$modelType": "P2",
            "y": 12,
          },
          "x": 5,
        },
      ],
    ]
  `)

  // if we apply the same sub-snapshot with the same id it should be reconciled instead
  reset()
  oldP2 = p.p2!
  const oldP2Sn = getSnapshot(oldP2)
  applySnapshot(p.p2!, { ...getSnapshot(oldP2), y: 256 })
  expect(p.p2).toBe(oldP2)
  expect(p.p2 instanceof BaseModel).toBe(true)
  expect(getSnapshot(p.p2)).not.toBe(oldP2Sn)

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
            "value": 256,
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
      ],
    ]
  `)

  expect(sn).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "$modelId": "id-2",
          "$modelType": "P",
          "arr": Array [],
          "p2": Object {
            "$modelId": "id-3",
            "$modelType": "P2",
            "y": 256,
          },
          "x": 5,
        },
        Object {
          "$modelId": "id-2",
          "$modelType": "P",
          "arr": Array [],
          "p2": Object {
            "$modelId": "id-3",
            "$modelType": "P2",
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
      p.arr.push(undefined as any)
    })
  ).toThrow("undefined is not supported inside arrays")
  expect(p.arr.length).toBe(0)

  runUnprotected(() => {
    p.arr.push(null as any)
  })
  expect(toJS(p.arr)).toEqual([null])
})

test("types", () => {
  assert(
    _ as SnapshotInOf<P2>,
    _ as {
      [modelIdKey]?: string
      y?: number | null
    } & {
      [modelTypeKey]?: string
    }
  )

  assert(
    _ as SnapshotOutOf<P2>,
    _ as {
      [modelIdKey]: string
      y: number
    } & {
      [modelTypeKey]?: string
    }
  )

  assert(
    _ as SnapshotInOf<P>,
    _ as {
      [modelIdKey]?: string
      x?: number | null
      arr?: number[] | null
      p2?: SnapshotInOf<P2>
    } & {
      [modelTypeKey]?: string
    }
  )

  assert(
    _ as SnapshotOutOf<P>,
    _ as {
      [modelIdKey]: string
      x: number
      arr: number[]
      p2: SnapshotOutOf<P2> | undefined
    } & {
      [modelTypeKey]?: string
    }
  )

  assert(
    _ as SnapshotInOf<ObjectMap<number>>,
    _ as {
      items?: {
        [k: string]: number
      }
      [modelTypeKey]?: string
      [modelIdKey]: string
    }
  )

  assert(
    _ as SnapshotOutOf<ObjectMap<number>>,
    _ as {
      items: {
        [k: string]: number
      }
      [modelTypeKey]?: string
      [modelIdKey]: string
    }
  )

  assert(
    _ as SnapshotInOf<ArraySet<number>>,
    _ as {
      items?: number[]
      [modelTypeKey]?: string
      [modelIdKey]: string
    }
  )

  assert(
    _ as SnapshotOutOf<ArraySet<number>>,
    _ as {
      items: number[]
      [modelTypeKey]?: string
      [modelIdKey]: string
    }
  )
})

test("snapshot with reserved property names", () => {
  @model("test/snapshotWithReservedPropNames")
  class M extends Model({ onInit: prop(4) }) {
    @modelAction
    setOnInit(n: number) {
      this.$.onInit = n
    }
  }

  const p = new M({})
  const sn = getSnapshot(p)
  expect((p as any).onInit).toBeUndefined()

  expect(sn).toMatchInlineSnapshot(`
    Object {
      "$modelType": "test/snapshotWithReservedPropNames",
      "onInit": 4,
    }
  `)

  const p2 = fromSnapshot(M, sn)
  expect((p2 as any).onInit).toBeUndefined()
  expect(p2.$.onInit).toBe(p.$.onInit)

  applySnapshot(p2, {
    ...sn,
    onInit: 10,
  })
  expect(p2.$.onInit).toBe(10)
  expect((p2 as any).onInit).toBeUndefined()
})

test("id-less reconciliation", () => {
  let id = 0

  @model("idlr/i")
  class I extends Model({}) {
    id = id++
  }

  @model("idlr/r")
  class R extends Model({
    arr: prop<I[]>(),
    m: prop<I>(),
  }) {}

  const r = new R({
    arr: [new I({}), new I({})],
    m: new I({}),
  })

  expect(r.arr[0].id).toBe(0)
  expect(r.arr[1].id).toBe(1)
  expect(r.m.id).toBe(2)

  applySnapshot(
    r,
    modelSnapshotOutWithMetadata(R, {
      arr: [modelSnapshotOutWithMetadata(I, {}), modelSnapshotOutWithMetadata(I, {})],
      m: modelSnapshotOutWithMetadata(I, {}),
    })
  )

  expect(r.m.id).toBe(2)
  // no reconciliation inside an array
  expect(r.arr[0].id).toBe(3)
  expect(r.arr[1].id).toBe(4)
})

test("id-full reconciliation", () => {
  let id = 0
  @model("idfr/i")
  class I extends Model({
    id2: idProp,
  }) {
    id = id++
  }

  @model("idfr/r")
  class R extends Model({
    arr: prop<I[]>(),
    m: prop<I>(),
  }) {}

  const r = new R({
    arr: [new I({ id2: "0" }), new I({ id2: "1" })],
    m: new I({ id2: "2" }),
  })

  expect(r.arr[0].id).toBe(0)
  expect(r.arr[1].id).toBe(1)
  expect(r.m.id).toBe(2)

  applySnapshot(
    r,
    modelSnapshotOutWithMetadata(R, {
      arr: [
        modelSnapshotOutWithMetadata(I, { id2: "0" }),
        modelSnapshotOutWithMetadata(I, { id2: "1" }),
      ],
      m: modelSnapshotOutWithMetadata(I, { id2: "2" }),
    })
  )

  expect(r.arr[0].id).toBe(0)
  expect(r.arr[1].id).toBe(1)
  expect(r.m.id).toBe(2)
})
