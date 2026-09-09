import { isTreeNode, Model, model, prop, toTreeNode } from "../../src"
import { isTweakedObject } from "../../src/tweaker/core"
import { treeNodeMetadata } from "../../src/tweaker/treeNodeMetadata"

@model("isTreeNode/Node")
class Node extends Model({ value: prop(1) }) {}

test("tree node detection excludes model data objects unless explicitly allowed", () => {
  const node = new Node({})
  for (const value of [node, toTreeNode({ value: 1 }), toTreeNode([1])]) {
    expect(isTreeNode(value)).toBe(true)
    expect(isTweakedObject(value, false)).toBe(true)
    expect(isTweakedObject(value, true)).toBe(true)
  }
  expect(isTreeNode(node.$)).toBe(false)
  expect(isTweakedObject(node.$, false)).toBe(false)
  expect(isTweakedObject(node.$, true)).toBe(true)
})

test("untweaked values are never tree nodes", () => {
  for (const value of [undefined, null, false, 1, "value", Symbol(), {}, [], () => {}]) {
    expect(isTreeNode(value)).toBe(false)
    expect(isTweakedObject(value, false)).toBe(false)
    expect(isTweakedObject(value, true)).toBe(false)
  }
})

test("tree node checks read metadata once per value", () => {
  const node = new Node({})
  const get = vi.spyOn(treeNodeMetadata, "get")
  try {
    // A second lookup per value would mean this regressed to asking
    // `hasDataObjectParent` before reading the metadata it already needs.
    expect(isTweakedObject(node, false)).toBe(true)
    expect(isTweakedObject(node.$, false)).toBe(false)
    expect(isTweakedObject({}, false)).toBe(false)
    expect(get).toHaveBeenCalledTimes(3)
  } finally {
    get.mockRestore()
  }
})
