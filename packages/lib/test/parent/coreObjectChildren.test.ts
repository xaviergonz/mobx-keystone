import { reaction } from "mobx"
import {
  _async,
  _await,
  applyPatches,
  applySnapshot,
  arrayActions,
  getCurrentActionContext,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelFlow,
  prop,
  runUnprotected,
} from "../../src"
import {
  getDeepObjectChildren,
  registerDeepObjectChildrenExtension,
} from "../../src/parent/coreObjectChildren"
import { treeNodeMetadata } from "../../src/tweaker/treeNodeMetadata"
import { ModelPool } from "../../src/utils/ModelPool"
import { testModel } from "../utils"

@testModel("LazyExtensionNode")
class LazyExtensionNode extends Model({
  id: idProp,
  children: prop<LazyExtensionNode[]>(() => []),
}) {
  @modelAction
  swapFirstTwoChildren() {
    const [first] = this.children.splice(0, 1)
    const [second] = this.children.splice(0, 1)
    this.children.push(second, first)
  }

  @modelAction
  detachMutateReattachFirstChild() {
    const child = this.children.pop()!
    child.children.push(new LazyExtensionNode({}))
    this.children.push(child)
  }

  @modelAction
  appendChild(child: LazyExtensionNode) {
    this.children.push(child)
  }

  @modelAction
  rotateThroughRunUnprotected() {
    const child = this.children.shift()!
    runUnprotected(() => {
      this.children.push(child)
    })
  }

  @modelFlow
  detachAndReattachAcrossFlowSteps = _async(function* (this: LazyExtensionNode) {
    const child = this.children.pop()!
    yield* _await(Promise.resolve())
    this.children.push(child)
  })
}

let deepNodeIdsBuilds = 0

const getDeepNodeIds = registerDeepObjectChildrenExtension<Set<string>>({
  initData() {
    deepNodeIdsBuilds++
    return new Set()
  },

  addNode(node, data) {
    if (node instanceof LazyExtensionNode) {
      data.add(node.id)
    }
  },

  removeNode(node, data) {
    if (node instanceof LazyExtensionNode) {
      data.delete(node.id)
    }
    return true
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

test("lazy deep children extensions initialize from current deep cache and follow later changes", () => {
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

  const buildsBefore = deepNodeIdsBuilds
  const ids = getDeepNodeIds.get(root)
  expect([...ids]).toEqual([mid.id, leafA.id, leafB.id])
  expect(getDeepNodeIds.get(root)).toBe(ids)

  runUnprotected(() => {
    root.children.pop()
  })
  expect(getDeepNodeIds.get(root)).toBe(ids)
  expect([...ids]).toEqual([])

  runUnprotected(() => {
    root.children.push(mid)
    leafA.children.push(new LazyExtensionNode({ id: "late" }))
  })
  expect(getDeepNodeIds.get(root)).toBe(ids)
  expect([...ids].sort()).toEqual([mid.id, leafA.id, leafB.id, "late"].sort())

  // incremental updates only, no rebuilds
  expect(deepNodeIdsBuilds).toBe(buildsBefore + 1)
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
  expect(firstPool.findModelByTypeAndId(removed.$modelType, removed.$modelId)).toBeUndefined()
  expect(firstPool.findModelByTypeAndId(kept.$modelType, kept.$modelId)).toBe(kept)
  expect(firstPool.findModelByTypeAndId(added.$modelType, added.$modelId)).toBe(added)
  firstPool.release()

  runUnprotected(() => {
    root.items.splice(1, 1, replacement)
  })

  const secondPool = new ModelPool(root)
  expect(secondPool.findModelByTypeAndId(kept.$modelType, kept.$modelId)).toBe(kept)
  expect(secondPool.findModelByTypeAndId(added.$modelType, added.$modelId)).toBeUndefined()
  expect(secondPool.findModelByTypeAndId(replacement.$modelType, replacement.$modelId)).toBe(
    replacement
  )
  secondPool.release()
})

test("applySnapshot reorders reuse deep children and extension indexes when membership is unchanged", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const snapshot = getSnapshot(root)

  const deepBefore = getDeepObjectChildren(root)
  const deepSetBefore = deepBefore.deep
  const idsBefore = getDeepNodeIds.get(root)

  applySnapshot(root, {
    ...snapshot,
    children: [...snapshot.children].reverse(),
  })

  expect(root.children).toHaveLength(2)
  expect(root.children[0]).toBe(second)
  expect(root.children[1]).toBe(first)

  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep).toBe(deepSetBefore)
  expect(getDeepNodeIds.get(root)).toBe(idsBefore)
  expect(deepAfter.deep.has(first)).toBe(true)
  expect(deepAfter.deep.has(second)).toBe(true)
})

test("applySnapshot membership changes still rebuild deep children and update extension indexes", () => {
  const kept = new LazyExtensionNode({})
  const removed = new LazyExtensionNode({})
  const added = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [kept, removed] })
  const snapshot = getSnapshot(root)

  const deepBefore = getDeepObjectChildren(root)
  const deepSetBefore = deepBefore.deep
  const idsBefore = getDeepNodeIds.get(root)

  applySnapshot(root, {
    ...snapshot,
    children: [snapshot.children[0], getSnapshot(added)],
  })

  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep).not.toBe(deepSetBefore)
  expect(getDeepNodeIds.get(root)).toBe(idsBefore)
  expect([...idsBefore]).toEqual([kept.id, root.children[1].id])
  expect(deepAfter.deep.has(kept)).toBe(true)
  expect(deepAfter.deep.has(removed)).toBe(false)
  expect(deepAfter.deep.has(root.children[1])).toBe(true)
})

test("a subtree mutated while detached and re-attached in the same action keeps deep children correct", () => {
  const child = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [child] })

  // build the deep index before the action
  const deepBefore = getDeepObjectChildren(root)
  expect(deepBefore.deep.has(child)).toBe(true)
  const idsBefore = getDeepNodeIds.get(root)

  root.detachMutateReattachFirstChild()

  const grandChild = child.children[0]
  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep.has(child)).toBe(true)
  expect(deepAfter.deep.has(grandChild)).toBe(true)
  expect(getDeepNodeIds.get(root)).toBe(idsBefore)
  expect([...idsBefore]).toEqual([child.id, grandChild.id])
})

test("array actions coalesce inverse membership changes at the root action boundary", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  expect(arrayActions.swap(root.children, 0, 1)).toBe(true)

  expect(root.children[0]).toBe(second)
  expect(root.children[1]).toBe(first)
  expect(getDeepObjectChildren(root).deep).toBe(deepSetBefore)
})

test("model actions coalesce inverse membership changes at the root action boundary", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  root.swapFirstTwoChildren()

  expect(root.children[0]).toBe(second)
  expect(root.children[1]).toBe(first)
  expect(getDeepObjectChildren(root).deep).toBe(deepSetBefore)
})

test("standalone runUnprotected coalesces inverse membership changes", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const deepBefore = getDeepObjectChildren(root)
  const idsBefore = getDeepNodeIds.get(root)

  runUnprotected(() => {
    const child = root.children.shift()!
    root.children.push(child)
    expect(getCurrentActionContext()).toBeUndefined()
  })

  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep).toBe(deepBefore.deep)
  expect(getDeepNodeIds.get(root)).toBe(idsBefore)
})

test("nested runUnprotected calls share the outer mutation batch", () => {
  const child = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [child] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  runUnprotected(() => {
    const removed = root.children.pop()!
    runUnprotected(() => {
      root.children.push(removed)
    })
  })

  expect(getDeepObjectChildren(root).deep).toBe(deepSetBefore)
})

test("a model action inside runUnprotected shares the outer mutation batch", () => {
  const child = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [child] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  runUnprotected(() => {
    const removed = root.children.pop()!
    root.appendChild(removed)
  })

  expect(getDeepObjectChildren(root).deep).toBe(deepSetBefore)
})

test("runUnprotected inside a model action shares the model action mutation batch", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  root.rotateThroughRunUnprotected()

  expect(getDeepObjectChildren(root).deep).toBe(deepSetBefore)
})

test("standalone runUnprotected membership changes still rebuild deep children", () => {
  const kept = new LazyExtensionNode({})
  const removed = new LazyExtensionNode({})
  const added = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [kept, removed] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  runUnprotected(() => {
    root.children.pop()
    root.children.push(added)
  })

  const deepAfter = getDeepObjectChildren(root).deep
  expect(deepAfter).not.toBe(deepSetBefore)
  expect(deepAfter.has(kept)).toBe(true)
  expect(deepAfter.has(removed)).toBe(false)
  expect(deepAfter.has(added)).toBe(true)
})

test("a subtree mutated while detached in runUnprotected remains correct after reattachment", () => {
  const child = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [child] })
  const idsBefore = getDeepNodeIds.get(root)

  runUnprotected(() => {
    root.children.pop()
    child.children.push(new LazyExtensionNode({}))
    root.children.push(child)
  })

  const grandChild = child.children[0]
  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep.has(child)).toBe(true)
  expect(deepAfter.deep.has(grandChild)).toBe(true)
  expect(getDeepNodeIds.get(root)).toBe(idsBefore)
  expect([...idsBefore]).toEqual([child.id, grandChild.id])
})

test("runUnprotected finishes its mutation batch after an exception", () => {
  const child = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [child] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  expect(() => {
    runUnprotected(() => {
      const removed = root.children.pop()!
      root.children.push(removed)
      throw new Error("expected")
    })
  }).toThrow("expected")

  expect(getCurrentActionContext()).toBeUndefined()
  expect(getDeepObjectChildren(root).deep).toBe(deepSetBefore)

  runUnprotected(() => {
    root.children.pop()
  })
  expect(getDeepObjectChildren(root).deep).not.toBe(deepSetBefore)
})

test("a mid-batch rebuild of a node dirtied before the batch is not wrongly restored", () => {
  const pChild = new LazyExtensionNode({})
  const p = new LazyExtensionNode({ children: [pChild] })
  const nChild = new LazyExtensionNode({})
  const n = new LazyExtensionNode({ children: [nChild] })
  const root = new LazyExtensionNode({ children: [p, n] })

  // build the whole deep index; everything clean
  getDeepObjectChildren(root)

  // dirty n's chain (and therefore root) without reading it back
  runUnprotected(() => {
    n.children.push(new LazyExtensionNode({}))
  })

  runUnprotected(() => {
    // p's chain is clean, so this creates the transaction with entries
    const p1 = p.children.pop()!
    // n's chain is dirty, so no invalidation entries exist for it or for root
    const c = n.children.pop()!
    // mid-batch rebuild: root/n rebuilt without entries, missing p1 and c
    getDeepObjectChildren(root)
    // net-zero completions
    p.children.push(p1)
    n.children.push(c)
  })

  const deep = getDeepObjectChildren(root).deep
  expect(deep.has(pChild)).toBe(true)
  expect(deep.has(nChild)).toBe(true)
})

test("a deep-children reaction rebuilds during the action and disables index reuse", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const deepSetBefore = getDeepObjectChildren(root).deep
  let reactions = 0
  const dispose = reaction(
    () => getDeepObjectChildren(root).deep,
    () => {
      reactions++
    }
  )

  root.swapFirstTwoChildren()

  const deepSetAfter = getDeepObjectChildren(root).deep
  expect(deepSetAfter).not.toBe(deepSetBefore)
  expect(reactions).toBe(1)
  expect(deepSetAfter.has(first)).toBe(true)
  expect(deepSetAfter.has(second)).toBe(true)
  dispose()
})

test("a deep-children reaction rebuilds during runUnprotected and disables index reuse", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const deepSetBefore = getDeepObjectChildren(root).deep
  let reactions = 0
  const dispose = reaction(
    () => getDeepObjectChildren(root).deep,
    () => {
      reactions++
    }
  )

  runUnprotected(() => {
    const child = root.children.shift()!
    root.children.push(child)
  })

  const deepSetAfter = getDeepObjectChildren(root).deep
  expect(deepSetAfter).not.toBe(deepSetBefore)
  expect(reactions).toBe(1)
  expect(deepSetAfter.has(first)).toBe(true)
  expect(deepSetAfter.has(second)).toBe(true)
  dispose()
})

test("model flow steps use separate mutation batches", async () => {
  const child = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [child] })
  const deepSetBefore = getDeepObjectChildren(root).deep

  await root.detachAndReattachAcrossFlowSteps()

  const deepSetAfter = getDeepObjectChildren(root).deep
  expect(deepSetAfter).not.toBe(deepSetBefore)
  expect(deepSetAfter.has(child)).toBe(true)
})

test("applyPatches coalesces a remove/add move within one patch action", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const firstSnapshot = getSnapshot(first)
  const deepSetBefore = getDeepObjectChildren(root).deep

  applyPatches(root, [
    { op: "remove", path: ["children", 0] },
    { op: "add", path: ["children", 1], value: firstSnapshot },
  ])

  expect(root.children[0]).toBe(second)
  expect(root.children[1]).toBe(first)
  expect(getDeepObjectChildren(root).deep).toBe(deepSetBefore)
})

@testModel("ModelPoolIdItem")
class ModelPoolIdItem extends Model({
  id: idProp,
  label: prop<string>(),
}) {
  @modelAction
  setId(id: string) {
    this.id = id
  }
}

@testModel("ModelPoolIdRoot")
class ModelPoolIdRoot extends Model({
  items: prop<ModelPoolIdItem[]>(() => []),
  other: prop<ModelPoolIdItem[]>(() => []),
}) {}

@testModel("LazyExtensionNodeHolder")
class LazyExtensionNodeHolder extends Model({
  holder: prop<ModelPoolIdRoot | undefined>(),
}) {}

const isDeepDirty = (node: object) => treeNodeMetadata.get(node)!.objectChildren!.deepDirty

test("structural applyPatches keeps the ModelPool index without rebuilding deep children", () => {
  const root = new ModelPoolIdRoot({
    items: [new ModelPoolIdItem({ id: "a", label: "a" })],
  })
  applySnapshot(root, { ...getSnapshot(root), items: [...getSnapshot(root).items] })
  new ModelPool(root).release()

  for (let i = 0; i < 3; i++) {
    const item = new ModelPoolIdItem({ id: `n${i}`, label: "n" })
    applyPatches(root, [
      { op: "add", path: ["items", root.items.length], value: getSnapshot(item) },
    ])
    expect(isDeepDirty(root)).toBe(true)
  }
  expect(root.items.map((i) => i.id)).toEqual(["a", "n0", "n1", "n2"])

  const n1 = root.items[2]
  const pool = new ModelPool(root)
  expect(pool.findModelByTypeAndId(n1.$modelType, "n1")).toBe(n1)
  pool.release()
  expect(isDeepDirty(root)).toBe(true)

  // moving a model through patches reuses the instance
  applyPatches(root, [
    { op: "remove", path: ["items", 2] },
    { op: "add", path: ["other", 0], value: getSnapshot(n1) },
  ])
  expect(root.other[0]).toBe(n1)
  expect(isDeepDirty(root)).toBe(true)
})

test("ModelPool keeps the view it was created with until released", () => {
  const a = new ModelPoolIdItem({ id: "a", label: "a" })
  const root = new ModelPoolIdRoot({ items: [a] })
  new ModelPool(root).release()

  const pool = new ModelPool(root)
  const b = new ModelPoolIdItem({ id: "b", label: "b" })
  runUnprotected(() => {
    root.items.splice(0, 1, b)
  })
  expect(pool.findModelByTypeAndId(a.$modelType, "a")).toBe(a)
  expect(pool.findModelByTypeAndId(b.$modelType, "b")).toBeUndefined()

  // a pool created meanwhile sees the current tree
  const pool2 = new ModelPool(root)
  expect(pool2.findModelByTypeAndId(a.$modelType, "a")).toBeUndefined()
  expect(pool2.findModelByTypeAndId(b.$modelType, "b")).toBe(b)
  pool2.release()

  pool.release()
  const pool3 = new ModelPool(root)
  expect(pool3.findModelByTypeAndId(a.$modelType, "a")).toBeUndefined()
  expect(pool3.findModelByTypeAndId(b.$modelType, "b")).toBe(b)
  pool3.release()
})

test("ModelPool follows model id changes", () => {
  const a = new ModelPoolIdItem({ id: "a", label: "a" })
  const root = new ModelPoolIdRoot({ items: [a] })
  new ModelPool(root).release()

  a.setId("z")

  const pool = new ModelPool(root)
  expect(pool.findModelByTypeAndId(a.$modelType, "a")).toBeUndefined()
  expect(pool.findModelByTypeAndId(a.$modelType, "z")).toBe(a)
  pool.release()

  // the model is reused when a snapshot moves it
  applySnapshot(root, { ...getSnapshot(root), items: [], other: [getSnapshot(a)] })
  expect(root.other[0]).toBe(a)
})

test("ModelPool handles duplicated model ids", () => {
  const first = new ModelPoolIdItem({ id: "dup", label: "first" })
  const second = new ModelPoolIdItem({ id: "dup", label: "second" })
  const root = new ModelPoolIdRoot({ items: [first] })
  new ModelPool(root).release()

  runUnprotected(() => {
    root.other.push(second)
  })
  let pool = new ModelPool(root)
  // last one in deep children order wins
  expect(pool.findModelByTypeAndId(first.$modelType, "dup")).toBe(second)
  pool.release()

  runUnprotected(() => {
    root.other.pop()
  })
  pool = new ModelPool(root)
  expect(pool.findModelByTypeAndId(first.$modelType, "dup")).toBe(first)
  pool.release()

  runUnprotected(() => {
    root.items.pop()
  })
  pool = new ModelPool(root)
  expect(pool.findModelByTypeAndId(first.$modelType, "dup")).toBeUndefined()
  pool.release()
})

test("ModelPool index of a subtree follows changes deep inside it", () => {
  const leaf = new ModelPoolIdItem({ id: "leaf", label: "leaf" })
  const inner = new ModelPoolIdRoot({ items: [leaf] })
  const outer = new LazyExtensionNodeHolder({ holder: inner })
  new ModelPool(outer).release()
  new ModelPool(inner).release()

  const other = new ModelPoolIdItem({ id: "other", label: "other" })
  runUnprotected(() => {
    inner.other.push(other)
    inner.items.pop()
  })

  for (const node of [outer, inner]) {
    const pool = new ModelPool(node)
    expect(pool.findModelByTypeAndId(leaf.$modelType, "leaf")).toBeUndefined()
    expect(pool.findModelByTypeAndId(other.$modelType, "other")).toBe(other)
    pool.release()
  }

  // detached subtrees keep their own index
  runUnprotected(() => {
    outer.holder = undefined
  })
  let pool = new ModelPool(outer)
  expect(pool.findModelByTypeAndId(other.$modelType, "other")).toBeUndefined()
  pool.release()
  pool = new ModelPool(inner)
  expect(pool.findModelByTypeAndId(other.$modelType, "other")).toBe(other)
  pool.release()
})
