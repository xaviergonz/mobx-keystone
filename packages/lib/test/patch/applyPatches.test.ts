import { toJS } from "mobx"
import {
  applyPatches,
  getSnapshot,
  jsonPatchToPatch,
  MobxKeystoneError,
  onPatches,
  type Patch,
  runUnprotected,
  toTreeNode,
} from "../../src"
import { createP } from "../testbed"

let p = createP(true)
beforeEach(() => {
  p = createP(true)
})

describe("object property", () => {
  let p2data: any
  beforeEach(() => {
    p2data = p.p2!.$
  })

  test("add", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "add",
          path: ["p2", "z"],
          value: 10,
        },
      ])
    })
    expect(p2data.z).toBe(10)
  })

  test("remove", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "remove",
          path: ["p2", "y"],
        },
      ])
    })
    expect(p2data.y).toBeUndefined()
  })

  test("nullish patches preserve property presence without applying model defaults", () => {
    applyPatches(p, [
      { op: "add", path: ["p2", "extra"], value: undefined },
      { op: "replace", path: ["p2", "y"], value: null },
    ])
    expect(Object.hasOwn(p2data, "extra")).toBe(true)
    expect(Object.hasOwn(getSnapshot(p.p2!), "extra")).toBe(true)
    expect(p2data.y).toBeNull()

    applyPatches(p, [{ op: "replace", path: ["p2", "y"], value: undefined }])
    expect(Object.hasOwn(p2data, "y")).toBe(true)
    expect(p2data.y).toBeUndefined()
  })

  test("replace", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "replace",
          path: ["p2", "y"],
          value: 10,
        },
      ])
    })
    expect(p2data.y).toBe(10)
  })

  test.each([undefined, false, true])("replace (reverse=%j)", (reverse) => {
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "replace",
            path: ["p2", "y"],
            value: 10,
          },
          {
            op: "replace",
            path: ["p2", "y"],
            value: 11,
          },
        ],
        reverse
      )
    })
    expect(p2data.y).toBe(reverse ? 10 : 11)
  })
})

describe("array", () => {
  test("add", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "add",
          path: ["arr", "1"],
          value: 10,
        },
      ])
    })
    expect(toJS(p.arr)).toEqual([1, 10, 2, 3])
  })

  test.each([undefined, false, true])("add (reverse=%j)", (reverse) => {
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "add",
            path: ["arr", "1"],
            value: 10,
          },
          {
            op: "add",
            path: ["arr", "1"],
            value: 11,
          },
        ],
        reverse
      )
    })
    expect(toJS(p.arr)).toEqual([1, reverse ? 10 : 11, reverse ? 11 : 10, 2, 3])
  })

  test("remove", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "remove",
          path: ["arr", "1"],
        },
      ])
    })
    expect(toJS(p.arr)).toEqual([1, 3])
  })

  test("replace", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "replace",
          path: ["arr", "1"],
          value: 10,
        },
      ])
    })
    expect(toJS(p.arr)).toEqual([1, 10, 3])
  })

  test.each([undefined, false, true])("replace (reverse=%j)", (reverse) => {
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "replace",
            path: ["arr", "1"],
            value: 10,
          },
          {
            op: "replace",
            path: ["arr", "1"],
            value: 11,
          },
        ],
        reverse
      )
    })
    expect(toJS(p.arr)).toEqual([1, reverse ? 10 : 11, 3])
  })
})

describe("whole object", () => {
  test("add", () => {
    const newSn = { ...getSnapshot(p.p2), $modelId: "some other id" } // since we can't have two objects with the same type and id under the same tree
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "add",
          path: ["p3"],
          value: newSn,
        },
      ])
    })
    expect(getSnapshot((p.$ as any).p3)).toStrictEqual(newSn)
  })

  test("remove", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "remove",
          path: ["p2"],
        },
      ])
    })
    expect(p.p2).toBeUndefined()
  })

  test("replace (same id)", () => {
    const oldP2 = p.p2!
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "replace",
          path: ["p2"],
          value: { ...getSnapshot(oldP2), y: 20 },
        },
      ])
    })
    expect(p.p2).toBe(oldP2)
    expect(p.p2!.y).toBe(20)
  })

  test.each([undefined, false, true])("replace (same id, reverse=%j)", (reverse) => {
    const oldP2 = p.p2!
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "replace",
            path: ["p2"],
            value: { ...getSnapshot(oldP2), y: 20 },
          },
          {
            op: "replace",
            path: ["p2"],
            value: { ...getSnapshot(oldP2), y: 21 },
          },
        ],
        reverse
      )
    })
    expect(p.p2).toBe(oldP2)
    expect(p.p2!.y).toBe(reverse ? 20 : 21)
  })
})

test("JSON Patch '-' appends to the end of an array", () => {
  const root = toTreeNode({ items: [1, 2] })
  applyPatches(root, [jsonPatchToPatch({ op: "add", path: "/items/-", value: 3 })])
  expect(getSnapshot(root)).toEqual({ items: [1, 2, 3] })
})

test.each(["add", "remove", "replace"] as const)(
  "%s rejects malformed array indexes without changing the array",
  (op) => {
    for (const index of ["foo", "", "01", "1.5", "Infinity", Number.NaN, 0.5, 4]) {
      const root = toTreeNode([1, 2])
      expect(() => applyPatches(root, [{ op, path: [index], value: 3 }])).toThrow(MobxKeystoneError)
      expect(getSnapshot(root)).toEqual([1, 2])
    }
  }
)

test.each(["remove", "replace"] as const)("%s requires an existing array index", (op) => {
  for (const index of [-1, "-", 2]) {
    const root = toTreeNode([1, 2])
    expect(() => applyPatches(root, [{ op, path: [index], value: 3 }])).toThrow(MobxKeystoneError)
    expect(getSnapshot(root)).toEqual([1, 2])
  }
})

test("array additions retain numeric end indexes and the negative-index extension", () => {
  const root = toTreeNode([1])
  applyPatches(root, [
    { op: "add", path: [1], value: 2 },
    { op: "add", path: ["2"], value: 3 },
    { op: "add", path: [-1], value: 4 },
  ])
  expect(getSnapshot(root)).toEqual([1, 2, 3, 4])
})

test.each(["add", "replace"] as const)("%s at the empty path replaces root contents", (op) => {
  const objectRoot = toTreeNode({ old: 1 })
  applyPatches(objectRoot, [{ op, path: [], value: { next: 2 } }])
  expect(getSnapshot(objectRoot)).toEqual({ next: 2 })
  const arrayRoot = toTreeNode([1, 2])
  applyPatches(arrayRoot, [{ op, path: [], value: [3] }])
  expect(getSnapshot(arrayRoot)).toEqual([3])
})

test("removing the root is rejected without changing it", () => {
  for (const root of [toTreeNode({ old: 1 }), toTreeNode([1, 2])]) {
    const before = getSnapshot(root)
    expect(() => applyPatches(root, [{ op: "remove", path: [] }])).toThrow(MobxKeystoneError)
    expect(getSnapshot(root)).toEqual(before)
  }
})

test("root replacement reconciles models and supports subsequent patches", () => {
  const child = p.p2
  const snapshot = getSnapshot(p)
  applyPatches(p, [
    { op: "replace", path: [], value: { ...snapshot, x: 7 } },
    { op: "replace", path: ["p2", "y"], value: 25 },
  ])
  expect(p.x).toBe(7)
  expect(p.p2).toBe(child)
  expect(p.p2!.y).toBe(25)
})

test.each(["add", "remove"] as const)("%s rejects the array 'length' property", (op) => {
  const root = toTreeNode([1, 2])
  expect(() => applyPatches(root, [{ op, path: ["length"], value: 0 }])).toThrow(MobxKeystoneError)
  expect(getSnapshot(root)).toEqual([1, 2])
})

test("replace still resizes an array through its 'length' property", () => {
  const root = toTreeNode([1, 2, 3])
  applyPatches(root, [{ op: "replace", path: ["length"], value: 1 }])
  expect(getSnapshot(root)).toEqual([1])
})

const arrayMutations: ReadonlyArray<readonly [string, (list: number[]) => void]> = [
  ["push", (l) => l.push(1, 2, 3)],
  ["unshift", (l) => l.unshift(0)],
  ["pop", (l) => l.pop()],
  ["shift", (l) => l.shift()],
  ["splice growing", (l) => l.splice(1, 1, 8, 9, 10)],
  ["splice shrinking", (l) => l.splice(1, 3, 8)],
  ["splice replacing", (l) => l.splice(0, 2, 7, 8)],
  ["splice removing all", (l) => l.splice(0, 5)],
  ["splice removing the tail", (l) => l.splice(3, 2)],
  ["sort", (l) => l.sort((a, b) => b - a)],
  ["reverse", (l) => l.reverse()],
  [
    "length truncation",
    (l) => {
      l.length = 1
    },
  ],
]

test.each(arrayMutations)(
  "emitted array patches for %s can be applied and reverted",
  (_name, mutate) => {
    const initial = [1, 2, 3, 4, 5]
    const source = toTreeNode<number[]>([...initial])
    const patches: Patch[] = []
    const inversePatches: Patch[] = []
    const disposePatches = onPatches(source, (p2, ip) => {
      patches.push(...p2)
      inversePatches.push(...ip)
    })
    runUnprotected(() => {
      mutate(source)
    })
    disposePatches()

    const mutated = getSnapshot(source)
    const target = toTreeNode<number[]>([...initial])
    applyPatches(target, patches)
    expect(getSnapshot(target)).toEqual(mutated)

    applyPatches(target, inversePatches, true)
    expect(getSnapshot(target)).toEqual(initial)
  }
)

test("a root patch with a non-object value is rejected", () => {
  const root = toTreeNode({ a: 1 })
  expect(() => applyPatches(root, [{ op: "replace", path: [], value: 5 }])).toThrow()
  expect(getSnapshot(root)).toEqual({ a: 1 })
})

test("a root patch rejected by type checking is rolled back", () => {
  const root = toTreeNode({ items: [1, 2] })
  expect(() =>
    applyPatches(root, [{ op: "replace", path: [], value: { items: [1, 2, undefined] } }])
  ).toThrow()
  expect(getSnapshot(root)).toEqual({ items: [1, 2] })
})
