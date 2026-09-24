import { observable, onReactionError, reaction, runInAction } from "mobx"
import {
  detach,
  getChildrenObjects,
  getParent,
  Model,
  onChildAttachedTo,
  prop,
  runUnprotected,
  toTreeNode,
} from "../../src"
import { autoDispose, testModel } from "../utils"

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

test("an undefined fireForCurrentChildren option keeps immediate attachment callbacks", () => {
  const root = toTreeNode([{ value: 1 }])
  const attached: object[] = []
  const detached: object[] = []
  const dispose = onChildAttachedTo(
    () => root,
    (child) => {
      attached.push(child)
      return () => {
        detached.push(child)
      }
    },
    { fireForCurrentChildren: undefined }
  )
  try {
    expect(attached).toEqual([root[0]])
  } finally {
    dispose(true)
  }
  expect(detached).toEqual([root[0]])
})

describe("incremental children tracking", () => {
  @testModel("onChildAttachedTo/incremental/Node")
  class Node extends Model({
    children: prop<Node[]>(() => []),
  }) {}

  type Event = [kind: "attach" | "detach", node: object]

  /** How children used to be tracked: a diff of all of them after every change. */
  function trackByDiff(target: () => object, deep: boolean, events: Event[]) {
    const current = new Set<object>()
    return reaction(
      () => new Set(getChildrenObjects(target(), { deep })),
      (children) => {
        const dead: object[] = []
        for (const n of current) {
          if (!children.has(n)) {
            current.delete(n)
            dead.push(n)
          }
        }
        for (let i = dead.length - 1; i >= 0; i--) {
          events.push(["detach", dead[i]])
        }
        for (const n of children) {
          if (!current.has(n)) {
            current.add(n)
            events.push(["attach", n])
          }
        }
      },
      { fireImmediately: true }
    )
  }

  test.each([false, true])(
    "matches a diff of all children after random changes (deep: %s)",
    (deep) => {
      let seed = 1
      const random = (max: number) => {
        seed = (seed * 16807) % 2147483647
        return seed % max
      }
      const newSubtree = (): Node =>
        new Node({ children: random(3) === 0 ? [new Node({}), new Node({})] : [] })

      const roots = [0, 1].map(
        () => new Node({ children: Array.from({ length: 150 }, () => newSubtree()) })
      )
      const targetRoot = observable.box(roots[0])
      const target = () => (deep ? targetRoot.get() : targetRoot.get().children)

      const expected: Event[] = []
      const actual: Event[] = []
      autoDispose(trackByDiff(target, deep, expected))
      const dispose = onChildAttachedTo(
        target,
        (n) => {
          actual.push(["attach", n])
          return () => {
            actual.push(["detach", n])
          }
        },
        { deep }
      )
      autoDispose(() => dispose(false))

      const nodesOf = (root: Node) => [
        root,
        ...(getChildrenObjects(root, { deep: true }) as Set<Node>),
      ]
      const allNodes = () =>
        [...nodesOf(roots[0]), ...nodesOf(roots[1])].filter((n): n is Node => n instanceof Node)

      let checked = 0
      for (let i = 0; i < 300; i++) {
        runUnprotected(() => {
          // mostly a few changes, and sometimes many
          const count = random(10) === 0 ? 40 : 1 + random(3)
          for (let j = 0; j < count; j++) {
            const nodes = allNodes()
            const node = nodes[random(nodes.length)]
            const op = random(5)
            if (op === 0 || roots.includes(node)) {
              node.children.splice(random(node.children.length + 1), 0, newSubtree())
            } else if (op === 1) {
              detach(node)
            } else if (op === 2) {
              // somewhere else, possibly below the other root
              const inside = new Set(nodesOf(node))
              const targets = nodes.filter((n) => !inside.has(n))
              const newParent = targets[random(targets.length)]
              detach(node)
              newParent.children.splice(random(newParent.children.length + 1), 0, node)
            } else {
              // back to the same parent, so it is still a child but was attached later
              const parent = getParent<Node[]>(node)!
              detach(node)
              parent.splice(random(parent.length + 1), 0, node)
            }
          }
        })
        if (random(40) === 0) {
          runInAction(() => targetRoot.set(targetRoot.get() === roots[0] ? roots[1] : roots[0]))
        }
        // compared by identity, since a deep comparison of every event so far
        // is too slow
        expect(actual.length).toBe(expected.length)
        for (; checked < actual.length; checked++) {
          expect(actual[checked][0]).toBe(expected[checked][0])
          expect(actual[checked][1]).toBe(expected[checked][1])
        }
      }
      expect(actual.length).toBeGreaterThan(300)
    }
  )
})
