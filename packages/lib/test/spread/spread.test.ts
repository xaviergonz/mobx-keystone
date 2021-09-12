import {
  getSnapshot,
  idProp,
  isTreeNode,
  model,
  Model,
  modelAction,
  modelIdKey,
  onPatches,
  Patch,
  prop,
} from "../../src"
import "../commonSetup"

test("reassigning an array via spreading", () => {
  @model("SpreadArr_Obj")
  class Obj extends Model({
    [modelIdKey]: idProp,
    x: prop(),
  }) {}

  @model("SpreadArr")
  class SpreadArr extends Model({
    [modelIdKey]: idProp,
    arr: prop<Obj[]>(() => []),
  }) {
    @modelAction
    add(x: number) {
      this.arr = [...this.arr, new Obj({ x })]
      return this.arr
    }

    @modelAction
    set(arr: Obj[]) {
      this.arr = arr
    }
  }

  const events: { patches: Patch[]; invPatches: Patch[] }[] = []

  const arr = new SpreadArr({})
  onPatches(arr, (patches, invPatches) => {
    events.push({
      patches,
      invPatches,
    })
  })

  const a1 = arr.add(1)
  const a2 = arr.add(2)
  const a3 = arr.add(3)

  expect(arr.arr[0].x).toBe(1)
  expect(arr.arr[1].x).toBe(2)
  expect(arr.arr[2].x).toBe(3)

  expect(getSnapshot(arr)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-1",
      "$modelType": "SpreadArr",
      "arr": Array [
        Object {
          "$modelId": "id-2",
          "$modelType": "SpreadArr_Obj",
          "x": 1,
        },
        Object {
          "$modelId": "id-3",
          "$modelType": "SpreadArr_Obj",
          "x": 2,
        },
        Object {
          "$modelId": "id-4",
          "$modelType": "SpreadArr_Obj",
          "x": 3,
        },
      ],
    }
  `)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [],
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [
              Object {
                "$modelId": "id-2",
                "$modelType": "SpreadArr_Obj",
                "x": 1,
              },
            ],
          },
        ],
      },
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [
              Object {
                "$modelId": "id-2",
                "$modelType": "SpreadArr_Obj",
                "x": 1,
              },
            ],
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [
              Object {
                "$modelId": "id-2",
                "$modelType": "SpreadArr_Obj",
                "x": 1,
              },
              Object {
                "$modelId": "id-3",
                "$modelType": "SpreadArr_Obj",
                "x": 2,
              },
            ],
          },
        ],
      },
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [
              Object {
                "$modelId": "id-2",
                "$modelType": "SpreadArr_Obj",
                "x": 1,
              },
              Object {
                "$modelId": "id-3",
                "$modelType": "SpreadArr_Obj",
                "x": 2,
              },
            ],
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [
              Object {
                "$modelId": "id-2",
                "$modelType": "SpreadArr_Obj",
                "x": 1,
              },
              Object {
                "$modelId": "id-3",
                "$modelType": "SpreadArr_Obj",
                "x": 2,
              },
              Object {
                "$modelId": "id-4",
                "$modelType": "SpreadArr_Obj",
                "x": 3,
              },
            ],
          },
        ],
      },
    ]
  `)
  events.length = 0

  expect(a1).not.toBe(a2)
  expect(a1).not.toBe(a3)

  expect(a2).not.toBe(a1)
  expect(a2).not.toBe(a3)

  expect(a3).not.toBe(a1)
  expect(a3).not.toBe(a2)

  expect(arr.arr).toBe(a3)

  expect(isTreeNode(a1)).toBeFalsy()
  expect(isTreeNode(a2)).toBeFalsy()
  expect(isTreeNode(a3)).toBeTruthy()

  arr.set(a1)
  expect(arr.arr).toHaveLength(1)

  expect(isTreeNode(a1)).toBeTruthy()
  expect(isTreeNode(a2)).toBeFalsy()
  expect(isTreeNode(a3)).toBeFalsy()

  expect(getSnapshot(arr)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-1",
      "$modelType": "SpreadArr",
      "arr": Array [
        Object {
          "$modelId": "id-2",
          "$modelType": "SpreadArr_Obj",
          "x": 1,
        },
      ],
    }
  `)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [
              Object {
                "$modelId": "id-2",
                "$modelType": "SpreadArr_Obj",
                "x": 1,
              },
              Object {
                "$modelId": "id-3",
                "$modelType": "SpreadArr_Obj",
                "x": 2,
              },
              Object {
                "$modelId": "id-4",
                "$modelType": "SpreadArr_Obj",
                "x": 3,
              },
            ],
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "arr",
            ],
            "value": Array [
              Object {
                "$modelId": "id-2",
                "$modelType": "SpreadArr_Obj",
                "x": 1,
              },
            ],
          },
        ],
      },
    ]
  `)
  events.length = 0
})

test("reassigning an object via spreading", () => {
  @model("SpreadObj_Obj")
  class Obj extends Model({
    [modelIdKey]: idProp,
    x: prop(),
  }) {}

  @model("SpreadObj")
  class SpreadObj extends Model({
    [modelIdKey]: idProp,
    spreadObj: prop<{ [k: string]: Obj }>(() => ({})),
  }) {
    @modelAction
    add(n: string, x: number) {
      this.spreadObj = {
        ...this.spreadObj,
        [n]: new Obj({ x }),
      }
      return this.spreadObj
    }

    @modelAction
    set(spreadObj: { [k: string]: Obj }) {
      this.spreadObj = spreadObj
    }
  }

  const events: { patches: Patch[]; invPatches: Patch[] }[] = []

  const o = new SpreadObj({})
  onPatches(o, (patches, invPatches) => {
    events.push({
      patches,
      invPatches,
    })
  })

  const o1 = o.add("one", 1)
  const o2 = o.add("two", 2)
  const o3 = o.add("three", 3)

  expect(o.spreadObj["one"].x).toBe(1)
  expect(o.spreadObj["two"].x).toBe(2)
  expect(o.spreadObj["three"].x).toBe(3)

  expect(getSnapshot(o)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-1",
      "$modelType": "SpreadObj",
      "spreadObj": Object {
        "one": Object {
          "$modelId": "id-2",
          "$modelType": "SpreadObj_Obj",
          "x": 1,
        },
        "three": Object {
          "$modelId": "id-4",
          "$modelType": "SpreadObj_Obj",
          "x": 3,
        },
        "two": Object {
          "$modelId": "id-3",
          "$modelType": "SpreadObj_Obj",
          "x": 2,
        },
      },
    }
  `)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {},
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {
              "one": Object {
                "$modelId": "id-2",
                "$modelType": "SpreadObj_Obj",
                "x": 1,
              },
            },
          },
        ],
      },
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {
              "one": Object {
                "$modelId": "id-2",
                "$modelType": "SpreadObj_Obj",
                "x": 1,
              },
            },
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {
              "one": Object {
                "$modelId": "id-2",
                "$modelType": "SpreadObj_Obj",
                "x": 1,
              },
              "two": Object {
                "$modelId": "id-3",
                "$modelType": "SpreadObj_Obj",
                "x": 2,
              },
            },
          },
        ],
      },
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {
              "one": Object {
                "$modelId": "id-2",
                "$modelType": "SpreadObj_Obj",
                "x": 1,
              },
              "two": Object {
                "$modelId": "id-3",
                "$modelType": "SpreadObj_Obj",
                "x": 2,
              },
            },
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {
              "one": Object {
                "$modelId": "id-2",
                "$modelType": "SpreadObj_Obj",
                "x": 1,
              },
              "three": Object {
                "$modelId": "id-4",
                "$modelType": "SpreadObj_Obj",
                "x": 3,
              },
              "two": Object {
                "$modelId": "id-3",
                "$modelType": "SpreadObj_Obj",
                "x": 2,
              },
            },
          },
        ],
      },
    ]
  `)
  events.length = 0

  expect(o1).not.toBe(o2)
  expect(o1).not.toBe(o3)

  expect(o2).not.toBe(o1)
  expect(o2).not.toBe(o3)

  expect(o3).not.toBe(o1)
  expect(o3).not.toBe(o2)

  expect(o.spreadObj).toBe(o3)

  expect(isTreeNode(o1)).toBeFalsy()
  expect(isTreeNode(o2)).toBeFalsy()
  expect(isTreeNode(o3)).toBeTruthy()

  o.set(o1)
  expect(Object.keys(o.spreadObj)).toEqual(["one"])

  expect(isTreeNode(o1)).toBeTruthy()
  expect(isTreeNode(o2)).toBeFalsy()
  expect(isTreeNode(o3)).toBeFalsy()

  expect(getSnapshot(o)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-1",
      "$modelType": "SpreadObj",
      "spreadObj": Object {
        "one": Object {
          "$modelId": "id-2",
          "$modelType": "SpreadObj_Obj",
          "x": 1,
        },
      },
    }
  `)

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "invPatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {
              "one": Object {
                "$modelId": "id-2",
                "$modelType": "SpreadObj_Obj",
                "x": 1,
              },
              "three": Object {
                "$modelId": "id-4",
                "$modelType": "SpreadObj_Obj",
                "x": 3,
              },
              "two": Object {
                "$modelId": "id-3",
                "$modelType": "SpreadObj_Obj",
                "x": 2,
              },
            },
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "spreadObj",
            ],
            "value": Object {
              "one": Object {
                "$modelId": "id-2",
                "$modelType": "SpreadObj_Obj",
                "x": 1,
              },
            },
          },
        ],
      },
    ]
  `)
  events.length = 0
})
