import { getSnapshot, idProp, Model, prop, runUnprotected } from "../../src"
import {
  getDeepObjectChildren,
  registerDeepObjectChildrenExtension,
} from "../../src/parent/coreObjectChildren"
import { ModelPool } from "../../src/utils/ModelPool"
import { testModel } from "../utils"

@testModel("LazyExtensionNode")
class LazyExtensionNode extends Model({
  id: idProp,
  children: prop<LazyExtensionNode[]>(() => []),
}) {}

const getDeepNodeIds = registerDeepObjectChildrenExtension<string[]>({
  initData() {
    return []
  },

  addNode(node, data) {
    if (node instanceof LazyExtensionNode) {
      data.push(node.id)
    }
  },
})

@testModel("ModelPoolItem")
class ModelPoolItem extends Model({
  id: idProp,
  label: prop<string>(),
}) {}

@testModel("ModelPoolRoot")
class ModelPoolRoot extends Model({
  items: prop<ModelPoolItem[]>(() => []),
}) {}

test("lazy deep children extensions initialize from current deep cache and rebuild after changes", () => {
  const leafA = new LazyExtensionNode({})
  const leafB = new LazyExtensionNode({})
  const mid = new LazyExtensionNode({
    children: [leafA],
  })
  const root = new LazyExtensionNode({
    children: [mid],
  })

  // Build the deep cache before the extension is ever read.
  getDeepObjectChildren(root)

  runUnprotected(() => {
    mid.children.push(leafB)
  })

  const firstIds = getDeepNodeIds(getDeepObjectChildren(root))
  expect(firstIds).toEqual([mid.id, leafA.id, leafB.id])
  expect(getDeepNodeIds(getDeepObjectChildren(root))).toBe(firstIds)

  runUnprotected(() => {
    root.children.pop()
  })

  const secondIds = getDeepNodeIds(getDeepObjectChildren(root))
  expect(secondIds).toEqual([])
  expect(secondIds).not.toBe(firstIds)
})

test("ModelPool sees current tree for first use after invalidation and after later rebuilds", () => {
  const removed = new ModelPoolItem({ label: "removed" })
  const kept = new ModelPoolItem({ label: "kept" })
  const added = new ModelPoolItem({ label: "added" })
  const replacement = new ModelPoolItem({ label: "replacement" })
  const root = new ModelPoolRoot({
    items: [removed, kept],
  })

  // Build the deep cache before the ModelPool extension is ever read.
  getDeepObjectChildren(root)

  runUnprotected(() => {
    root.items.splice(0, 1)
    root.items.push(added)
  })

  const firstPool = new ModelPool(root)
  expect(firstPool.findModelForSnapshot(getSnapshot(removed))).toBeUndefined()
  expect(firstPool.findModelForSnapshot(getSnapshot(kept))).toBe(kept)
  expect(firstPool.findModelForSnapshot(getSnapshot(added))).toBe(added)

  runUnprotected(() => {
    root.items.splice(1, 1, replacement)
  })

  const secondPool = new ModelPool(root)
  expect(secondPool.findModelForSnapshot(getSnapshot(kept))).toBe(kept)
  expect(secondPool.findModelForSnapshot(getSnapshot(added))).toBeUndefined()
  expect(secondPool.findModelForSnapshot(getSnapshot(replacement))).toBe(replacement)
})
