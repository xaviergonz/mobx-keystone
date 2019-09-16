import { autorun, observable, ObservableMap, runInAction } from "mobx"
import {
  AnyModel,
  detach,
  model,
  Model,
  modelAction,
  prop,
  walkTree,
  WalkTreeMode,
} from "../../src"
import { optimizedWalkTreeSearch } from "../../src/parent/optimizedWalkTree"
import "../commonSetup"

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
        n => {
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

  @model("root")
  class Root extends Model({
    children: prop<Child[]>(() => []),
  }) {
    readonly registry = registry<string, Child>(this, n => {
      if (n instanceof Child) {
        return n.id
      }
      return undefined
    })
  }

  @model("child")
  class Child extends Model({
    id: prop<string>(),
  }) {}

  const c1 = new Child({ id: "1" })
  const c2 = new Child({ id: "2" })
  const c3 = new Child({ id: "3" })
  const r = new Root({
    children: [c1, c2, c3],
  })
  expect([...r.registry.entries()]).toEqual([["1", c1], ["2", c2], ["3", c3]])

  detach(c2)

  expect([...r.registry.entries()]).toEqual([["1", c1], ["3", c3]])
})

test("optimizedWalkTree", () => {
  @model("root2")
  class Root extends Model({
    children: prop<Child[]>(() => []),
  }) {
    id = "root"

    @modelAction
    addChild(child: Child) {
      this.children.push(child)
    }
  }

  @model("child2")
  class Child extends Model({
    id: prop<string>(),
    child: prop<Child | undefined>(undefined),
  }) {
    @modelAction
    setId(id: string) {
      this.id = id
    }
  }

  const c1 = new Child({ id: "1", child: new Child({ id: "1-1" }) })
  const c2 = new Child({ id: "2", child: new Child({ id: "2-1" }) })
  const c3 = new Child({ id: "3", child: new Child({ id: "3-1" }) })
  const r = new Root({
    children: [c1, c2, c3],
  })

  const visited: string[] = []

  const alreadyVisited = new WeakMap<object, any>()
  const revisit = () => {
    optimizedWalkTreeSearch(r, alreadyVisited, n => {
      visited.push((n as any).id)
    })
  }

  // initial
  revisit()
  // undefined is the children array
  expect(visited).toMatchInlineSnapshot(`
    Array [
      "root",
      undefined,
      "1",
      "1-1",
      "2",
      "2-1",
      "3",
      "3-1",
    ]
  `)
  visited.length = 0

  // nothing changed
  revisit()
  expect(visited).toMatchInlineSnapshot(`Array []`)
  visited.length = 0

  // add a child
  r.addChild(new Child({ id: "4", child: new Child({ id: "4-1" }) }))
  revisit()
  expect(visited).toMatchInlineSnapshot(`
    Array [
      "root",
      undefined,
      "4",
      "4-1",
    ]
  `)
  visited.length = 0

  // nothing changed
  revisit()
  expect(visited).toMatchInlineSnapshot(`Array []`)
  visited.length = 0

  // change a deep child
  r.children[0]!.child!.setId("1-1ch")
  revisit()
  expect(visited).toMatchInlineSnapshot(`
    Array [
      "root",
      undefined,
      "1",
      "1-1ch",
    ]
  `)
  visited.length = 0

  // nothing changed
  revisit()
  expect(visited).toMatchInlineSnapshot(`Array []`)
  visited.length = 0

  // change a shallow child
  r.children[0]!.setId("1ch")
  revisit()
  expect(visited).toMatchInlineSnapshot(`
    Array [
      "root",
      undefined,
      "1ch",
    ]
  `)
  visited.length = 0

  // nothing changed
  revisit()
  expect(visited).toMatchInlineSnapshot(`Array []`)
  visited.length = 0
})
