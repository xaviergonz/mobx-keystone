import { autorun, observable, ObservableMap, runInAction } from "mobx"
import { AnyModel, detach, model, Model, prop, walkTree, WalkTreeMode } from "../../src"

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

  @model("root")
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
