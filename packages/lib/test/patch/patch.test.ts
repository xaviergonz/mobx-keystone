import {
  applyPatches,
  getSnapshot,
  model,
  Model,
  modelAction,
  onPatches,
  Patch,
  prop,
  registerRootStore,
  runUnprotected,
  unregisterRootStore,
} from "../../src"
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
      pInvPatches
        .slice()
        .reverse()
        .forEach(invpatches => applyPatches(p, invpatches, true))
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
                "$modelId": "id-1",
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

  // splice one in the middle
  reset()
  runUnprotected(() => {
    p.arr.splice(1, 1) // [1, 3]
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
              "value": 3,
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

  // splice items at the end that do not exist
  reset()
  runUnprotected(() => {
    p.arr.splice(3, 2, 5) // [1, 2, 3, 5]
  })

  expect(pPatches).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "op": "add",
          "path": Array [
            "arr",
            3,
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

  // splice items over the end that do not exist
  reset()
  runUnprotected(() => {
    p.arr.splice(8, 2, 5) // [1, 2, 3, 5]
  })

  expect(pPatches).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "op": "add",
          "path": Array [
            "arr",
            3,
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

  // unshift items
  reset()
  runUnprotected(() => {
    p.arr.unshift(10, 11) // [10, 11, 1, 2, 3]
  })

  expect(pPatches).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "op": "replace",
          "path": Array [
            "arr",
            0,
          ],
          "value": 10,
        },
        Object {
          "op": "replace",
          "path": Array [
            "arr",
            1,
          ],
          "value": 11,
        },
        Object {
          "op": "replace",
          "path": Array [
            "arr",
            2,
          ],
          "value": 1,
        },
        Object {
          "op": "add",
          "path": Array [
            "arr",
            3,
          ],
          "value": 2,
        },
        Object {
          "op": "add",
          "path": Array [
            "arr",
            4,
          ],
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
          "path": Array [
            "arr",
            0,
          ],
          "value": 1,
        },
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
})

test("patches with reserved prop names", () => {
  @model("test/patchesWithReservedPropNames")
  class M extends Model({ onInit: prop(4) }) {
    @modelAction
    setOnInit(n: number) {
      this.$.onInit = n
    }
  }

  const p = new M({})
  const sn = getSnapshot(p)

  const pPatches: Patch[][] = []
  const pInvPatches: Patch[][] = []
  autoDispose(
    onPatches(p, (ptchs, iptchs) => {
      pPatches.push(ptchs)
      pInvPatches.push(iptchs)
    })
  )

  function reset() {
    pPatches.length = 0
    pInvPatches.length = 0
  }

  function expectSameSnapshotOnceReverted() {
    runUnprotected(() => {
      pInvPatches
        .slice()
        .reverse()
        .forEach(invpatches => applyPatches(p, invpatches, true))
    })
    expect(getSnapshot(p)).toStrictEqual(sn)
  }

  // no changes should result in no patches
  reset()
  runUnprotected(() => {
    p.$.onInit = p.$.onInit + 0
  })

  expect(pPatches).toMatchInlineSnapshot(`Array []`)
  expect(pInvPatches).toMatchInlineSnapshot(`Array []`)

  reset()
  runUnprotected(() => {
    p.$.onInit++
  })

  expect(pPatches).toMatchInlineSnapshot(`
                        Array [
                          Array [
                            Object {
                              "op": "replace",
                              "path": Array [
                                "onInit",
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
                                "onInit",
                              ],
                              "value": 4,
                            },
                          ],
                        ]
            `)

  expectSameSnapshotOnceReverted()
})

test("patches with action in onAttachedToRootStore", () => {
  @model("test/patchesWithActionInOnAttachedToRootStore/M")
  class M extends Model({ value: prop<number>(0) }) {
    onAttachedToRootStore() {
      this.setValue(1)
    }

    @modelAction
    setValue(value: number) {
      this.value = value
    }
  }

  @model("test/patchesWithActionInOnAttachedToRootStore/R")
  class R extends Model({ ms: prop<M[]>(() => []) }) {
    @modelAction
    addM(m: M) {
      this.ms.push(m)
    }
  }

  const r = new R({})
  autoDispose(() => unregisterRootStore(r))
  registerRootStore(r)

  const sn = getSnapshot(r)

  const rPatches: Patch[][] = []
  const rInvPatches: Patch[][] = []
  autoDispose(
    onPatches(r, (ptchs, iptchs) => {
      rPatches.push(ptchs)
      rInvPatches.push(iptchs)
    })
  )
  expect(rPatches).toMatchInlineSnapshot(`Array []`)
  expect(rInvPatches).toMatchInlineSnapshot(`Array []`)

  r.addM(new M({}))

  expect(rPatches).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "op": "add",
          "path": Array [
            "ms",
            0,
          ],
          "value": Object {
            "$modelId": "id-5",
            "$modelType": "test/patchesWithActionInOnAttachedToRootStore/M",
            "value": 0,
          },
        },
      ],
      Array [
        Object {
          "op": "replace",
          "path": Array [
            "ms",
            0,
            "value",
          ],
          "value": 1,
        },
      ],
    ]
  `)
  expect(rInvPatches).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "op": "replace",
          "path": Array [
            "ms",
            "length",
          ],
          "value": 0,
        },
      ],
      Array [
        Object {
          "op": "replace",
          "path": Array [
            "ms",
            0,
            "value",
          ],
          "value": 0,
        },
      ],
    ]
  `)

  runUnprotected(() => {
    rInvPatches
      .slice()
      .reverse()
      .forEach(invpatches => applyPatches(r, invpatches, true))
  })
  expect(getSnapshot(r)).toStrictEqual(sn)
})
