import {
  applyPatches,
  applySnapshot,
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelIdKey,
  modelTypeKey,
  onGlobalPatches,
  onPatches,
  Patch,
  prop,
  registerRootStore,
  runUnprotected,
  unregisterRootStore,
} from "../../src"
import { createP, P2 } from "../testbed"
import { autoDispose, testModel } from "../utils"

describe("onPatches and applyPatches", () => {
  function setup(withArray = false) {
    const p = createP(withArray)
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

    const globalPatchesCalls: { target: object; patches: Patch[]; inversePatches: Patch[] }[] = []
    autoDispose(
      onGlobalPatches((target, patches, inversePatches) => {
        globalPatchesCalls.push({ target, patches, inversePatches })
      })
    )

    function expectSameSnapshotOnceReverted() {
      runUnprotected(() => {
        pInvPatches
          .slice()
          .reverse()
          .forEach((invpatches) => applyPatches(p, invpatches, true))
      })
      expect(getSnapshot(p)).toStrictEqual(sn)
    }

    return {
      p,
      sn,
      pPatches,
      pInvPatches,
      p2Patches,
      p2InvPatches,
      expectSameSnapshotOnceReverted,
      globalPatchesCalls,
    }
  }

  test("no changes should result in no patches", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches } = setup(true)

    runUnprotected(() => {
      p.x = p.x // eslint-disable-line no-self-assign
      p.arr[0] = p.arr[0] // eslint-disable-line no-self-assign
      p.p2!.y = p.p2!.y
    })

    expect(pPatches).toMatchInlineSnapshot(`[]`)
    expect(pInvPatches).toMatchInlineSnapshot(`[]`)
    expect(p2Patches).toMatchInlineSnapshot(`[]`)
    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)
  })

  test("increment numbers", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup()

    runUnprotected(() => {
      p.x++
      p.p2!.y++
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "x",
            ],
            "value": 6,
          },
        ],
        [
          {
            "op": "replace",
            "path": [
              "p2",
              "y",
            ],
            "value": 13,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "x",
            ],
            "value": 5,
          },
        ],
        [
          {
            "op": "replace",
            "path": [
              "p2",
              "y",
            ],
            "value": 12,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "y",
            ],
            "value": 13,
          },
        ],
      ]
    `)

    expect(p2InvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "y",
            ],
            "value": 12,
          },
        ],
      ]
    `)

    expectSameSnapshotOnceReverted()
  })

  test("remove subobj", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup()

    runUnprotected(() => {
      p.p2 = undefined
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "p2",
            ],
            "value": undefined,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "p2",
            ],
            "value": {
              "$modelId": "id-1",
              "$modelType": "P2",
              "y": 12,
            },
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("swap items around", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)
    runUnprotected(() => {
      p.arr = [3, 2, 1]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
            ],
            "value": [
              3,
              2,
              1,
            ],
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
            ],
            "value": [
              1,
              2,
              3,
            ],
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("splice items (less items)", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.splice(1, 2, 5) // [1, 5]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 1,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 5,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              2,
            ],
            "value": 3,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 2,
          },
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 1,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("splice items (more items)", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.splice(1, 2, 5, 6, 7) // [1, 5, 6, 7]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 1,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 5,
          },
          {
            "op": "add",
            "path": [
              "arr",
              2,
            ],
            "value": 6,
          },
          {
            "op": "add",
            "path": [
              "arr",
              3,
            ],
            "value": 7,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              2,
            ],
            "value": 3,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 2,
          },
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 1,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("splice items (same items)", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.splice(1, 2, 5, 3) // [1, 5, 3]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "remove",
            "path": [
              "arr",
              1,
            ],
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 5,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 2,
          },
          {
            "op": "remove",
            "path": [
              "arr",
              1,
            ],
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("splice one in the middle", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.splice(1, 1) // [1, 3]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "remove",
            "path": [
              "arr",
              1,
            ],
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 2,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("splice items at the end that do not exist", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.splice(3, 2, 5) // [1, 2, 3, 5]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              3,
            ],
            "value": 5,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 3,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("splice items over the end that do not exist", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.splice(8, 2, 5) // [1, 2, 3, 5]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              3,
            ],
            "value": 5,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 3,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("unshift items", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.unshift(10, 11) // [10, 11, 1, 2, 3]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              0,
            ],
            "value": 10,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 11,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "remove",
            "path": [
              "arr",
              0,
            ],
          },
          {
            "op": "remove",
            "path": [
              "arr",
              1,
            ],
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("unshift items (empty array)", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(false)

    runUnprotected(() => {
      p.arr.unshift(10, 11) // [10, 11]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              0,
            ],
            "value": 10,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 11,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 0,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("push items", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    runUnprotected(() => {
      p.arr.push(10, 11) // [1, 2, 3, 10, 11]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              3,
            ],
            "value": 10,
          },
          {
            "op": "add",
            "path": [
              "arr",
              4,
            ],
            "value": 11,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 3,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("push items (empty array)", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(false)

    runUnprotected(() => {
      p.arr.push(10, 11) // [10, 11]
    })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              0,
            ],
            "value": 10,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 11,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 0,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("reconciliation should generate patches", () => {
    const { p, pPatches, pInvPatches, p2Patches, p2InvPatches, expectSameSnapshotOnceReverted } =
      setup(true)

    applySnapshot(p, { ...getSnapshot(p), x: 10, arr: [1] })

    expect(pPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "replace",
            "path": [
              "arr",
              "length",
            ],
            "value": 1,
          },
        ],
        [
          {
            "op": "replace",
            "path": [
              "x",
            ],
            "value": 10,
          },
        ],
      ]
    `)

    expect(pInvPatches).toMatchInlineSnapshot(`
      [
        [
          {
            "op": "add",
            "path": [
              "arr",
              2,
            ],
            "value": 3,
          },
          {
            "op": "add",
            "path": [
              "arr",
              1,
            ],
            "value": 2,
          },
        ],
        [
          {
            "op": "replace",
            "path": [
              "x",
            ],
            "value": 5,
          },
        ],
      ]
    `)

    expect(p2Patches).toMatchInlineSnapshot(`[]`)

    expect(p2InvPatches).toMatchInlineSnapshot(`[]`)

    expectSameSnapshotOnceReverted()
  })

  test("global patches are emitted", () => {
    const { p, globalPatchesCalls } = setup(true)

    runUnprotected(() => {
      p.x++
    })

    expect(globalPatchesCalls).toMatchInlineSnapshot(`
      [
        {
          "inversePatches": [
            {
              "op": "replace",
              "path": [
                "x",
              ],
              "value": 5,
            },
          ],
          "patches": [
            {
              "op": "replace",
              "path": [
                "x",
              ],
              "value": 6,
            },
          ],
          "target": P {
            "$": {
              "$modelId": "id-2",
              "arr": [
                1,
                2,
                3,
              ],
              "p2": P2 {
                "$": {
                  "$modelId": "id-1",
                  "y": 12,
                },
                "$modelType": "P2",
              },
              "x": 6,
            },
            "$modelType": "P",
            "boundAction": [Function],
            "boundNonAction": [Function],
          },
        },
      ]
    `)
  })
})

test("patches with reserved prop names", () => {
  @testModel("M")
  class M extends Model({
    [modelIdKey]: idProp,
    onInit: prop(4),
  }) {
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
        .forEach((invpatches) => applyPatches(p, invpatches, true))
    })
    expect(getSnapshot(p)).toStrictEqual(sn)
  }

  // no changes should result in no patches
  reset()
  runUnprotected(() => {
    p.$.onInit = p.$.onInit + 0
  })

  expect(pPatches).toMatchInlineSnapshot(`[]`)
  expect(pInvPatches).toMatchInlineSnapshot(`[]`)

  reset()
  runUnprotected(() => {
    p.$.onInit++
  })

  expect(pPatches).toMatchInlineSnapshot(`
    [
      [
        {
          "op": "replace",
          "path": [
            "onInit",
          ],
          "value": 5,
        },
      ],
    ]
  `)

  expect(pInvPatches).toMatchInlineSnapshot(`
    [
      [
        {
          "op": "replace",
          "path": [
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
  @testModel("M")
  class M extends Model({
    [modelIdKey]: idProp,
    value: prop<number>(0),
  }) {
    onAttachedToRootStore() {
      this.setValue(1)
    }

    @modelAction
    setValue(value: number) {
      this.value = value
    }
  }

  @testModel("R")
  class R extends Model({
    [modelIdKey]: idProp,
    ms: prop<M[]>(() => []),
  }) {
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
  expect(rPatches).toMatchInlineSnapshot(`[]`)
  expect(rInvPatches).toMatchInlineSnapshot(`[]`)

  r.addM(new M({}))

  expect(rPatches).toMatchInlineSnapshot(`
    [
      [
        {
          "op": "add",
          "path": [
            "ms",
            0,
          ],
          "value": {
            "$modelId": "id-2",
            "$modelType": "patches with action in onAttachedToRootStore/M",
            "value": 0,
          },
        },
      ],
      [
        {
          "op": "replace",
          "path": [
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
    [
      [
        {
          "op": "replace",
          "path": [
            "ms",
            "length",
          ],
          "value": 0,
        },
      ],
      [
        {
          "op": "replace",
          "path": [
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
      .forEach((invpatches) => applyPatches(r, invpatches, true))
  })
  expect(getSnapshot(r)).toStrictEqual(sn)
})

test("patches should be generated when defaults are applied to a new model snapshot", () => {
  const globalPatchesCalls: { target: object; patches: Patch[]; inversePatches: Patch[] }[] = []
  autoDispose(
    onGlobalPatches((target, patches, inversePatches) => {
      globalPatchesCalls.push({ target, patches, inversePatches })
    })
  )

  // new never generates patches
  new P2({})

  expect(globalPatchesCalls).toMatchInlineSnapshot(`[]`)
  globalPatchesCalls.length = 0

  // should result in one patch for y and other for modelType
  fromSnapshot(P2, { [modelIdKey]: "id-1" })

  expect(globalPatchesCalls).toMatchInlineSnapshot(`
[
  {
    "inversePatches": [
      {
        "op": "remove",
        "path": [
          "y",
        ],
      },
      {
        "op": "remove",
        "path": [
          "$modelType",
        ],
      },
    ],
    "patches": [
      {
        "op": "add",
        "path": [
          "y",
        ],
        "value": 10,
      },
      {
        "op": "add",
        "path": [
          "$modelType",
        ],
        "value": "P2",
      },
    ],
    "target": P2 {
      "$": {
        "$modelId": "id-1",
        "y": 10,
      },
      "$modelType": "P2",
    },
  },
]
`)

  globalPatchesCalls.length = 0

  // should result no patches
  fromSnapshot(P2, { y: 10, $modelId: "id-1", [modelTypeKey]: "P2" })

  expect(globalPatchesCalls).toMatchInlineSnapshot(`[]`)

  globalPatchesCalls.length = 0
})
