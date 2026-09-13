import { addActionMiddleware, objectActions, toTreeNode } from "../../src"

test("middleware can dispose itself without skipping the following middleware", () => {
  const root = toTreeNode({ value: 0 })
  const calls: string[] = []
  const disposeFirst = addActionMiddleware({
    subtreeRoot: root,
    middleware(_ctx, next) {
      calls.push("first")
      disposeFirst()
      return next()
    },
  })
  const disposeSecond = addActionMiddleware({
    subtreeRoot: root,
    middleware(_ctx, next) {
      calls.push("second")
      return next()
    },
  })
  try {
    objectActions.set(root, "value", 1)
    expect(calls).toEqual(["first", "second"])
    calls.length = 0
    objectActions.set(root, "value", 2)
    expect(calls).toEqual(["second"])
    expect(root.value).toBe(2)
  } finally {
    disposeFirst()
    disposeSecond()
  }
})

test("middleware registered during an action starts with the next action", () => {
  const root = toTreeNode({ value: 0 })
  const calls: string[] = []
  let disposeAdded: (() => void) | undefined
  const disposeFirst = addActionMiddleware({
    subtreeRoot: root,
    middleware(_ctx, next) {
      disposeAdded ??= addActionMiddleware({
        subtreeRoot: root,
        middleware(_ctx, next) {
          calls.push("added")
          return next()
        },
      })
      return next()
    },
  })
  const disposeSecond = addActionMiddleware({
    subtreeRoot: root,
    middleware(_ctx, next) {
      calls.push("second")
      return next()
    },
  })
  try {
    objectActions.set(root, "value", 1)
    expect(calls).toEqual(["second"])
    calls.length = 0
    objectActions.set(root, "value", 2)
    expect(calls).toEqual(["second", "added"])
  } finally {
    disposeFirst()
    disposeSecond()
    disposeAdded?.()
  }
})
