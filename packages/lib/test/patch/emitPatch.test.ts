import {
  MobxKeystoneAggregateError,
  objectActions,
  onGlobalPatches,
  onPatches,
  patchRecorder,
  toTreeNode,
} from "../../src"

test("a failing patch listener does not suppress other listeners", () => {
  const root = toTreeNode({ child: { value: 0 } })
  const error = new Error("listener failed")
  const global = onGlobalPatches(() => {
    throw error
  })
  const localListener = vi.fn()
  const parentListener = vi.fn()
  const local = onPatches(root.child, localListener)
  const parent = onPatches(root, parentListener)
  try {
    expect(() => objectActions.set(root.child, "value", 1)).toThrow(error)
    expect(localListener).toHaveBeenCalledOnce()
    expect(parentListener).toHaveBeenCalledOnce()
  } finally {
    global()
    local()
    parent()
  }
})

test("a failing patch listener does not suppress later listeners on the same node", () => {
  const root = toTreeNode({ value: 0 })
  const first = onPatches(root, () => {
    throw new Error("listener failed")
  })
  const listener = vi.fn()
  const second = onPatches(root, listener)
  try {
    expect(() => objectActions.set(root, "value", 1)).toThrow("listener failed")
    expect(listener).toHaveBeenCalledOnce()
  } finally {
    first()
    second()
  }
})

test("a failing recorder on a child does not stop recorders on ancestors", () => {
  const root = toTreeNode({ child: { value: 0 } })
  const failing = patchRecorder(root.child, {
    onPatches: () => {
      throw new Error("recorder failed")
    },
  })
  const rootRecorder = patchRecorder(root)
  try {
    expect(() => objectActions.set(root.child, "value", 1)).toThrow("recorder failed")
    expect(rootRecorder.events).toHaveLength(1)
    expect(rootRecorder.events[0].patches).toEqual([
      { op: "replace", path: ["child", "value"], value: 1 },
    ])
  } finally {
    failing.dispose()
    rootRecorder.dispose()
  }
})

test("a failing recorder does not skip deferred listener delivery", () => {
  const root = toTreeNode({ value: 0 })
  const failing = patchRecorder(root, {
    onPatches: () => {
      throw new Error("recorder failed")
    },
  })
  const listener = vi.fn()
  const dispose = onPatches(root, listener)
  try {
    expect(() => objectActions.set(root, "value", 1)).toThrow("recorder failed")
    expect(listener).toHaveBeenCalledOnce()
  } finally {
    failing.dispose()
    dispose()
  }
})

test("several failing listeners are grouped in a MobxKeystoneAggregateError", () => {
  const root = toTreeNode({ value: 0 })
  const first = new Error("first")
  const second = new Error("second")
  const disposeFirst = onPatches(root, () => {
    throw first
  })
  const disposeSecond = onPatches(root, () => {
    throw second
  })
  const listener = vi.fn()
  const disposeThird = onPatches(root, listener)
  try {
    let caught: unknown
    try {
      objectActions.set(root, "value", 1)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(MobxKeystoneAggregateError)
    expect((caught as MobxKeystoneAggregateError).errors).toEqual([first, second])
    expect(listener).toHaveBeenCalledOnce()
  } finally {
    disposeFirst()
    disposeSecond()
    disposeThird()
  }
})
