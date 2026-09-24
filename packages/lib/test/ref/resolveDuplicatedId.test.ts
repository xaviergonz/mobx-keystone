import { autorun } from "mobx"
import {
  detach,
  getModelRefId,
  idProp,
  Model,
  objectActions,
  prop,
  resolveId,
  runUnprotected,
  toTreeNode,
  WalkTreeMode,
  walkTree,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("resolveDuplicatedId/Node")
class Node extends Model({
  id: idProp,
  code: prop(""),
  children: prop<Node[]>(() => []),
}) {}

const getCode = (node: object) => (node instanceof Node && node.code ? node.code : undefined)

/** The last node with the id a children-first walk finds, which is the one expected to win. */
function resolveByWalk(root: object, id: string, getId: (node: object) => string | undefined) {
  let found: object | undefined
  walkTree(
    root,
    (node) => {
      if (getId(node) === id) {
        found = node
      }
    },
    WalkTreeMode.ChildrenFirst
  )
  return found
}

test("an ancestor wins over its descendants, and otherwise the later attached sibling", () => {
  const getKey = (node: object) => Reflect.get(node, "key") as string | undefined
  const root = toTreeNode({ key: "same", first: { key: "same" }, second: { key: "same" } })
  const seen: unknown[] = []
  autoDispose(autorun(() => seen.push(resolveId(root, "same", getKey))))

  expect(seen).toEqual([root])
  runUnprotected(() => objectActions.set(root, "key", "root"))
  expect(seen).toEqual([root, root.second])
  runUnprotected(() => objectActions.set(root.second, "key", "second"))
  expect(seen).toEqual([root, root.second, root.first])
})

test("the order of siblings is the order they were attached in, not their index", () => {
  const first = new Node({ id: "dup" })
  const second = new Node({ id: "dup" })
  const root = new Node({ children: [first] })
  runUnprotected(() => root.children.unshift(second))
  expect(root.children.slice()).toEqual([second, first])

  expect(resolveId(root, "dup")).toBe(second)
  expect(resolveId(root, "dup")).toBe(resolveByWalk(root, "dup", getModelRefId))
})

test("unrelated structural changes do not re-resolve a duplicated id", () => {
  const root = new Node({
    children: [new Node({ id: "dup" }), new Node({ children: [new Node({ id: "dup" })] })],
  })
  let runs = 0
  autoDispose(
    autorun(() => {
      runs++
      resolveId(root, "dup")
    })
  )

  // (shifting the index of a candidate in a small array does re-resolve, since
  // its parent path changes, but that only costs O(candidates × depth))
  runUnprotected(() => {
    root.children.push(new Node({ children: [new Node({})] }))
    root.children[1].children.push(new Node({}))
    root.children[2].children[0].children.push(new Node({ id: "other" }))
  })
  expect(runs).toBe(1)

  // moving a candidate re-resolves
  runUnprotected(() => {
    const moved = root.children[1]
    detach(moved)
    root.children.push(moved)
  })
  expect(runs).toBe(2)
})

test.each([
  ["model ids", getModelRefId],
  ["a custom getId", getCode],
])("duplicated %s resolve like a tree walk after random changes", (_, getId) => {
  let seed = 1
  const random = (max: number) => {
    seed = (seed * 16807) % 2147483647
    return seed % max
  }
  // few ids, so most of them are duplicated
  const ids = ["a", "b", "c", "d", "e"]
  const randomId = () => ids[random(ids.length)]

  const root = new Node({})
  const nodes = () => {
    const all: Node[] = []
    walkTree(
      root,
      (node) => {
        if (node instanceof Node) {
          all.push(node)
        }
      },
      WalkTreeMode.ParentFirst
    )
    return all
  }
  const isInside = (node: object, ancestor: Node) => {
    let found = false
    walkTree(
      ancestor,
      (n) => {
        if (n === node) {
          found = true
          return true
        }
        return undefined
      },
      WalkTreeMode.ParentFirst
    )
    return found
  }

  const seen = new Map<string, unknown>()
  for (const id of ids) {
    autoDispose(autorun(() => seen.set(id, resolveId(root, id, getId))))
  }

  for (let i = 0; i < 400; i++) {
    runUnprotected(() => {
      const all = nodes()
      const node = all[random(all.length)]
      const op = random(5)
      if (op <= 1 || all.length < 5) {
        const target = all[random(all.length)]
        target.children.splice(
          random(target.children.length + 1),
          0,
          new Node({ id: randomId(), code: randomId() })
        )
      } else if (op === 2 && node !== root) {
        detach(node)
      } else if (op === 3 && node !== root) {
        // move it (with its subtree) somewhere else
        const targets = all.filter((n) => !isInside(n, node))
        const target = targets[random(targets.length)]
        detach(node)
        target.children.splice(random(target.children.length + 1), 0, node)
      } else if (random(2) === 0) {
        node.id = randomId()
      } else {
        node.code = randomId()
      }
    })

    for (const id of ids) {
      const expected = resolveByWalk(root, id, getId)
      expect(resolveId(root, id, getId)).toBe(expected)
      expect(seen.get(id)).toBe(expected)
    }
  }
})
