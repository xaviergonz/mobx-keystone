import { autorun, type ObservableMap, observable, runInAction } from "mobx"
import { type AnyModel, detach, Model, prop, toTreeNode, WalkTreeMode, walkTree } from "../../src"
import { testModel } from "../utils"

test("walktree should be reactive", () => {
  type Registry<K, V extends object> = ObservableMap<K, V>
  function registry<K, V extends object>(
    root: AnyModel,
    getId: (child: unknown) => K | undefined
  ): Registry<K, V> {
    const reg = observable.map<K, V>([], { deep: false })

    autorun(() => {
      const childrenThere = new Set<V>()
      walkTree(
        root,
        (n) => {
          const id = getId(n)
          if (id !== undefined) {
            childrenThere.add(n as any)
          }
        },
        WalkTreeMode.ParentFirst
      )

      // remove/update
      runInAction(() => {
        for (const [id, c] of reg.entries()) {
          if (!childrenThere.has(c)) {
            reg.delete(id)
          }
        }
        for (const c of childrenThere) {
          reg.set(getId(c)!, c)
        }
      })
    })

    return reg
  }

  @testModel("root")
  class Root extends Model({
    children: prop<Child[]>(() => []),
  }) {
    readonly registry = registry<string, Child>(this, (n) => {
      if (n instanceof Child) {
        return n.id
      }
      return undefined
    })
  }

  @testModel("child")
  class Child extends Model({
    id: prop<string>(),
  }) {}

  const c1 = new Child({ id: "1" })
  const c2 = new Child({ id: "2" })
  const c3 = new Child({ id: "3" })
  const r = new Root({
    children: [c1, c2, c3],
  })
  expect([...r.registry.entries()]).toEqual([
    ["1", c1],
    ["2", c2],
    ["3", c3],
  ])

  detach(c2)

  expect([...r.registry.entries()]).toEqual([
    ["1", c1],
    ["3", c3],
  ])
})

test("children-first traversal preserves sibling order", () => {
  const root = toTreeNode({ a: { child: {} }, b: {} })
  const visited: object[] = []
  walkTree(
    root,
    (node) => {
      visited.push(node)
    },
    WalkTreeMode.ChildrenFirst
  )
  expect(visited).toEqual([root.a.child, root.a, root.b, root])
})

test("children-first traversal supports deep trees and stops at the first result", () => {
  const leaf = toTreeNode({})
  const nodes: object[] = [leaf]
  for (let i = 0; i < 15000; i++) {
    nodes.push(toTreeNode({ child: nodes[nodes.length - 1] }))
  }
  const root = nodes[nodes.length - 1]
  const visited: object[] = []
  walkTree(
    root,
    (node) => {
      visited.push(node)
    },
    WalkTreeMode.ChildrenFirst
  )
  expect(visited).toEqual(nodes)
  const stop = vi.fn((node: object) => (node === leaf ? false : undefined))
  expect(walkTree(root, stop, WalkTreeMode.ChildrenFirst)).toBe(false)
  expect(stop).toHaveBeenCalledTimes(1)
})
