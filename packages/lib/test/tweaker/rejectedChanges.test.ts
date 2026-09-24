import { set } from "mobx"
import {
  DataModel,
  getParent,
  getSnapshot,
  isTreeNode,
  Model,
  onPatches,
  type Patch,
  prop,
  registerRootStore,
  runUnprotected,
  toTreeNode,
} from "../../src"
import { testModel } from "../utils"

@testModel("rejectedChanges/Item")
class Item extends Model({ n: prop(0) }) {}

@testModel("rejectedChanges/Root")
class Root extends Model({ plain: prop<any[]>(() => []), obj: prop<any>(() => ({})) }) {}

@testModel("rejectedChanges/Data")
class Data extends DataModel({ n: prop(0) }) {}

const alreadyHasOne = "an object cannot be assigned a new parent when it already has one"

function setup() {
  const root = new Root({
    plain: [
      { x: 1, inner: { y: 1 } },
      { x: 2, inner: { y: 2 } },
    ],
    obj: { a: { x: 1, inner: { y: 1 } } },
  })
  const patches: Patch[] = []
  onPatches(root, (p) => {
    patches.push(...p)
  })
  const nodes = [root.plain[0], root.plain[0].inner, root.plain[1], root.obj.a, root.obj.a.inner]
  const sn = getSnapshot(root)

  // the tree must be unchanged and still in sync with its snapshot and patches
  const expectUnchanged = () => {
    expect(getSnapshot(root)).toBe(sn)
    for (const node of nodes) {
      expect(isTreeNode(node)).toBe(true)
    }
    expect(getParent(root.plain[0])).toBe(root.plain)
    expect(getParent(root.plain[0].inner)).toBe(root.plain[0])
    expect(getParent(root.obj.a)).toBe(root.obj)
    expect(patches).toEqual([])

    runUnprotected(() => {
      root.plain[0].inner.y = 10
      root.obj.a.inner.y = 10
    })
    expect(getSnapshot(root).plain[0].inner.y).toBe(10)
    expect(getSnapshot(root).obj.a.inner.y).toBe(10)
    expect(patches).toHaveLength(2)
  }

  return { root, expectUnchanged }
}

const unsupportedValues: [string, () => unknown, string | RegExp][] = [
  ["a map", () => new Map(), "maps are not directly supported"],
  ["a set", () => new Set(), "sets are not directly supported"],
  ["a data model", () => new Data({}), "data models are not directly supported"],
  ["a class instance", () => new (class {})(), /^tweak can only work over/],
  ["a nested map", () => ({ ok: { x: 1 }, bad: [new Map()] }), "maps are not directly supported"],
  [
    "a root store",
    () => registerRootStore(new Item({})),
    "root stores cannot be attached to any parents",
  ],
  ["a node with a parent", () => ({ nested: new Root({}).obj }), alreadyHasOne],
  [
    "a model '$' object",
    () => new Item({}).$,
    "value must be the model object instance instead of the '$' sub-object",
  ],
]

describe.each(unsupportedValues)("adding %s", (_, makeValue, error) => {
  const tries: [string, (root: Root) => void][] = [
    ["splice", (root) => root.plain.splice(0, 1, makeValue())],
    ["push", (root) => root.plain.push({ ok: 1 }, makeValue())],
    ["array index setter", (root) => (root.plain[0] = makeValue())],
    ["object property update", (root) => (root.obj.a = makeValue())],
    ["object property add", (root) => set(root.obj, "b", makeValue())],
  ]

  test.each(tries)("with %s is rejected without changing anything", (_, change) => {
    const { root, expectUnchanged } = setup()
    expect(() => {
      runUnprotected(() => change(root))
    }).toThrow(error)
    expectUnchanged()
  })
})

test("a rejected change does not leave the valid values it adds attached", () => {
  const { root, expectUnchanged } = setup()
  const item = new Item({})
  const obj = toTreeNode({ x: 1 })

  expect(() => {
    runUnprotected(() => root.plain.push(item, obj, new Map()))
  }).toThrow("maps are not directly supported")
  expect(() => {
    runUnprotected(() => root.plain.push({ item, bad: new Set() }))
  }).toThrow("sets are not directly supported")
  expect(getParent(item)).toBeUndefined()
  expect(getParent(obj)).toBeUndefined()
  expectUnchanged()

  runUnprotected(() => root.plain.push(item, obj))
  expect(getParent(item)).toBe(root.plain)
  expect(getParent(obj)).toBe(root.plain)
})

test("the same node cannot be added twice, even nested", () => {
  const { root, expectUnchanged } = setup()
  const item = new Item({})

  expect(() => {
    runUnprotected(() => root.plain.push({ a: item, b: [item] }))
  }).toThrow(alreadyHasOne)
  expect(() => {
    runUnprotected(() => set(root.obj, "b", { a: item, b: item }))
  }).toThrow(alreadyHasOne)
  expect(getParent(item)).toBeUndefined()
  expectUnchanged()
})

test("children of the values being replaced can be moved into the new values", () => {
  const { root } = setup()
  const inner0 = root.plain[0].inner
  const inner1 = root.plain[1].inner
  const objInner = root.obj.a.inner

  runUnprotected(() => {
    root.plain.splice(0, 1, inner0)
    root.plain[1] = { wrapped: inner1 }
    root.obj.a = [objInner]
  })

  expect(root.plain[0]).toBe(inner0)
  expect(root.plain[1].wrapped).toBe(inner1)
  expect(root.obj.a[0]).toBe(objInner)
  expect(getSnapshot(root.plain)).toEqual([{ y: 1 }, { wrapped: { y: 2 } }])
  expect(getSnapshot(root.obj)).toEqual({ a: [{ y: 1 }] })
})

test("children of values that are not being replaced cannot be moved", () => {
  const { root, expectUnchanged } = setup()

  expect(() => {
    runUnprotected(() => root.plain.splice(0, 1, root.plain[1].inner))
  }).toThrow(alreadyHasOne)
  expect(() => {
    runUnprotected(() => (root.plain[0] = { wrapped: root.plain[1].inner }))
  }).toThrow(alreadyHasOne)
  expect(() => {
    runUnprotected(() => (root.obj.a = { wrapped: root.plain[0].inner }))
  }).toThrow(alreadyHasOne)
  expectUnchanged()
})
