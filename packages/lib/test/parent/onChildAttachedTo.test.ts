import { onReactionError } from "mobx"
import { onChildAttachedTo, runUnprotected, toTreeNode } from "../../src"

test("disposing child hooks detaches descendants before ancestors", () => {
  const root = toTreeNode({ child: { grandchild: {} } })
  const detached: object[] = []
  const dispose = onChildAttachedTo(
    () => root,
    (child) => () => {
      detached.push(child)
    },
    { deep: true }
  )
  dispose(true)
  expect(detached).toEqual([root.child.grandchild, root.child])
})

test("disposing child hooks runs all cleanups even if one throws", () => {
  const root = toTreeNode([{}, {}, {}])
  const detached: object[] = []
  const error = new Error("cleanup failed")
  const dispose = onChildAttachedTo(
    () => root,
    (child) => () => {
      detached.push(child)
      if (child === root[1]) throw error
    }
  )
  expect(() => dispose(true)).toThrow(error)
  expect(new Set(detached)).toEqual(new Set(root))
  dispose(true)
  expect(detached).toHaveLength(3)
})

test("a failed detachment cleanup does not skip other detachments or new attachments", () => {
  const root = toTreeNode([{}, {}, {}])
  const removed = [...root]
  const detached: object[] = []
  const attached: object[] = []
  const error = new Error("cleanup failed")
  const errors: unknown[] = []
  const stopErrors = onReactionError((error) => errors.push(error))
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
  const dispose = onChildAttachedTo(
    () => root,
    (child) => {
      attached.push(child)
      return () => {
        detached.push(child)
        if (child === removed[1]) throw error
      }
    }
  )
  try {
    runUnprotected(() => root.splice(0, 3, {}))
    expect(detached).toEqual([...removed].reverse())
    expect(attached).toEqual([...removed, root[0]])
    expect(errors).toEqual([error])
  } finally {
    dispose(false)
    stopErrors()
    consoleError.mockRestore()
  }
})

test("a failed attachment callback does not skip other new children", () => {
  const root = toTreeNode<{ value: number }[]>([])
  const attached: number[] = []
  const error = new Error("attachment failed")
  const errors: unknown[] = []
  const stopErrors = onReactionError((error) => errors.push(error))
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
  const dispose = onChildAttachedTo(
    () => root,
    (child) => {
      const value = (child as { value: number }).value
      attached.push(value)
      if (value === 1) throw error
    }
  )
  try {
    runUnprotected(() => root.push({ value: 1 }, { value: 2 }))
    expect(attached).toEqual([1, 2])
    expect(errors).toEqual([error])
  } finally {
    dispose(false)
    stopErrors()
    consoleError.mockRestore()
  }
})

test.each([true, false])("disposal inside attachment honors cleanup=%s", (cleanup) => {
  const root = toTreeNode<object[]>([])
  const detach = vi.fn()
  const attach = vi.fn(() => {
    dispose(cleanup)
    return detach
  })
  const dispose = onChildAttachedTo(() => root, attach, { fireForCurrentChildren: false })
  runUnprotected(() => root.push({}, {}))
  expect(attach).toHaveBeenCalledTimes(1)
  expect(detach).toHaveBeenCalledTimes(cleanup ? 1 : 0)
  dispose(true)
  expect(detach).toHaveBeenCalledTimes(cleanup ? 1 : 0)
})
