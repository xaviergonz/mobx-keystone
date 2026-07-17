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

test("applySnapshot reorders reuse deep children and extension indexes when membership is unchanged", () => {
  const first = new LazyExtensionNode({})
  const second = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [first, second] })
  const snapshot = getSnapshot(root)

  const deepBefore = getDeepObjectChildren(root)
  const deepSetBefore = deepBefore.deep
  const idsBefore = getDeepNodeIds(deepBefore)

  applySnapshot(root, {
    ...snapshot,
    children: [...snapshot.children].reverse(),
  })

  expect(root.children).toHaveLength(2)
  expect(root.children[0]).toBe(second)
  expect(root.children[1]).toBe(first)

  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep).toBe(deepSetBefore)
  expect(getDeepNodeIds(deepAfter)).toBe(idsBefore)
  expect(deepAfter.deep.has(first)).toBe(true)
  expect(deepAfter.deep.has(second)).toBe(true)
})

test("applySnapshot membership changes still rebuild deep children and extension indexes", () => {
  const kept = new LazyExtensionNode({})
  const removed = new LazyExtensionNode({})
  const added = new LazyExtensionNode({})
  const root = new LazyExtensionNode({ children: [kept, removed] })
  const snapshot = getSnapshot(root)

  const deepBefore = getDeepObjectChildren(root)
  const deepSetBefore = deepBefore.deep
  const idsBefore = getDeepNodeIds(deepBefore)

  applySnapshot(root, {
    ...snapshot,
    children: [snapshot.children[0], getSnapshot(added)],
  })

  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep).not.toBe(deepSetBefore)
  expect(getDeepNodeIds(deepAfter)).not.toBe(idsBefore)
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
  const idsBefore = getDeepNodeIds(deepBefore)

  root.detachMutateReattachFirstChild()

  const grandChild = child.children[0]
  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep.has(child)).toBe(true)
  expect(deepAfter.deep.has(grandChild)).toBe(true)
  expect(getDeepNodeIds(deepAfter)).not.toBe(idsBefore)
  expect(getDeepNodeIds(deepAfter)).toContain(grandChild.id)
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
  const idsBefore = getDeepNodeIds(deepBefore)

  runUnprotected(() => {
    const child = root.children.shift()!
    root.children.push(child)
    expect(getCurrentActionContext()).toBeUndefined()
  })

  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep).toBe(deepBefore.deep)
  expect(getDeepNodeIds(deepAfter)).toBe(idsBefore)
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
  const idsBefore = getDeepNodeIds(getDeepObjectChildren(root))

  runUnprotected(() => {
    root.children.pop()
    child.children.push(new LazyExtensionNode({}))
    root.children.push(child)
  })

  const grandChild = child.children[0]
  const deepAfter = getDeepObjectChildren(root)
  expect(deepAfter.deep.has(child)).toBe(true)
  expect(deepAfter.deep.has(grandChild)).toBe(true)
  expect(getDeepNodeIds(deepAfter)).not.toBe(idsBefore)
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
