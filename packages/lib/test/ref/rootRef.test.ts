import { expectTypeOf } from "expect-type"
import {
  autorun,
  computed,
  getDependencyTree,
  type IDependencyTree,
  reaction,
  remove,
  runInAction,
  set,
} from "mobx"
import {
  applyPatches,
  applySnapshot,
  clone,
  detach,
  fromSnapshot,
  getParent,
  getRefsResolvingTo,
  getRoot,
  getSnapshot,
  idProp,
  isRefOfType,
  Model,
  modelAction,
  modelIdKey,
  onPatches,
  type Patch,
  prop,
  type Ref,
  resolveId,
  rootRef,
  runUnprotected,
  tProp,
  types,
  undoMiddleware,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("Country")
class Country extends Model({
  id: prop<string>(),
  weather: prop<string>(),
}) {
  getRefId() {
    return this.id
  }

  @modelAction
  setId(id: string) {
    this.id = id
  }
}

@testModel("Countries")
class Countries extends Model({
  countries: prop<Record<string, Country>>(() => ({})),
  selectedCountryRef: prop<Ref<Country> | undefined>(),
  selectedCountriesRef: prop<Ref<Country>[]>(() => []),
}) {
  @computed
  get selectedCountry() {
    return this.selectedCountryRef ? this.selectedCountryRef.current : undefined
  }

  @computed
  get selectedCountries() {
    return this.selectedCountriesRef.map((r) => r.current)
  }

  @modelAction
  removeCountry(name: string) {
    // this is valid in mobx5 but not mobx4
    // delete this.countries[name]
    remove(this.countries, name)
  }

  @modelAction
  addCountry(c: Country) {
    set(this.countries, c.id, c)
  }

  @modelAction
  setSelectedCountry(country: Country | undefined) {
    this.selectedCountryRef = country ? countryRef(country) : undefined
  }

  @modelAction
  setSelectedCountryRef(ref: Ref<Country> | undefined) {
    this.selectedCountryRef = ref
  }

  @modelAction
  setSelectedCountries(countries: Country[]) {
    this.selectedCountriesRef = countries.map((c) => countryRef(c))
  }
}

const countryRef = rootRef<Country>("countryRef", {
  onResolvedValueChange(ref, newValue, oldValue) {
    expect(newValue !== oldValue)
    if (oldValue && !newValue) {
      detach(ref)
    }
  },
})

const initialCountries: () => Record<string, Country> = () => ({
  spain: new Country({
    id: "spain",
    weather: "sunny",
  }),
  uk: new Country({
    id: "uk",
    weather: "rainy",
  }),
  france: new Country({
    id: "france",
    weather: "soso",
  }),
})

test("single ref works", () => {
  const c = new Countries({
    countries: initialCountries(),
  })

  expect(c.selectedCountryRef).toBeUndefined()
  expect(c.selectedCountry).toBeUndefined()

  const spain = c.countries.spain
  c.setSelectedCountry(spain)
  expect(c.selectedCountry).toBe(spain)

  const r = c.selectedCountryRef!
  expect(getSnapshot(r)).toMatchInlineSnapshot(`
    {
      "$modelType": "countryRef",
      "id": "spain",
    }
  `)
  expect(r.isValid).toBe(true)
  expect(r.maybeCurrent).toBe(spain)
  expect(r.current).toBe(spain)
  expect(r.id).toBe(spain.id)

  // cloning should be ok
  const cloneC = clone(c)
  expect(cloneC.countries.spain).toBeTruthy()
  const cloneCSelectedCountry = cloneC.selectedCountry
  expect(cloneCSelectedCountry).toBe(cloneC.countries.spain)

  // remove referenced country
  c.removeCountry("spain")

  // should auto detach itself
  expect(c.selectedCountry).toBeUndefined()
  expect(c.selectedCountryRef).toBeUndefined()

  expect(getParent(r)).toBeUndefined()
  expect(r.isValid).toBe(false)
  expect(r.maybeCurrent).toBeUndefined()
  expect(() => r.current).toThrow(
    "a reference of type 'countryRef' could not resolve an object with id 'spain'"
  )

  // clone should not be affected
  expect(cloneC.selectedCountry).toBe(cloneC.countries.spain)
})

test("array ref works", () => {
  const c = new Countries({
    countries: initialCountries(),
  })

  expect(c.selectedCountriesRef).toEqual([])
  expect(c.selectedCountries).toEqual([])

  const spain = c.countries.spain
  const uk = c.countries.uk
  c.setSelectedCountries([spain, uk])
  expect(c.selectedCountries).toEqual([spain, uk])

  const r = c.selectedCountriesRef
  expect(getSnapshot(r)).toMatchInlineSnapshot(`
    [
      {
        "$modelType": "countryRef",
        "id": "spain",
      },
      {
        "$modelType": "countryRef",
        "id": "uk",
      },
    ]
  `)
  expect(r.map((rr) => rr.isValid)).toEqual([true, true])
  expect(r.map((rr) => rr.maybeCurrent)).toEqual([spain, uk])
  expect(r.map((rr) => rr.current)).toEqual([spain, uk])

  // cloning should be ok
  const cloneC = clone(c)
  expect(cloneC.countries.spain).toBeTruthy()
  expect(cloneC.countries.uk).toBeTruthy()
  expect(cloneC.selectedCountries).toEqual([cloneC.countries.spain, cloneC.countries.uk])

  // remove referenced country
  const oldR = r.slice()
  c.removeCountry("spain")

  // should auto detach itself
  expect(c.selectedCountries).toEqual([uk])
  expect(c.selectedCountriesRef).toHaveLength(1)

  expect(getParent(oldR[0])).toBeUndefined()
  expect(oldR[0].isValid).toBe(false)
  expect(oldR[0].maybeCurrent).toBeUndefined()
  expect(() => oldR[0].current).toThrow(
    "a reference of type 'countryRef' could not resolve an object with id 'spain'"
  )

  expect(c.selectedCountriesRef[0]).toBe(oldR[1])
  expect(getParent(oldR[1])).toBe(c.selectedCountriesRef)
  expect(oldR[1].isValid).toBe(true)
  expect(oldR[1].maybeCurrent).toBe(uk)
  expect(oldR[1].current).toBe(uk)

  // clone should not be affected
  expect(cloneC.selectedCountries).toEqual([cloneC.countries.spain, cloneC.countries.uk])
})

test("single selection with custom getId", () => {
  @testModel("myApp/Todo")
  class Todo extends Model({ id: prop<string>() }) {
    @modelAction
    setId(id: string) {
      this.id = id
    }
  }

  @testModel("myApp/TodoList")
  class TodoList extends Model({
    list: prop<Todo[]>(() => []),
    selectedRef: prop<Ref<Todo> | undefined>(),
  }) {
    // ...

    // not strictly needed, but neat
    @computed
    get selectedTodo() {
      return this.selectedRef ? this.selectedRef.current : undefined
    }

    @modelAction
    selectTodo(todo: Todo | undefined) {
      if (todo && !this.list.includes(todo)) {
        throw new Error("unknown todo")
      }
      this.selectedRef = todo ? todoRef(todo) : undefined
    }
  }

  const todoRef = rootRef<Todo>("myApp/TodoRef", {
    getId(todo) {
      return todo instanceof Todo ? todo.id : undefined
    },

    onResolvedValueChange(ref, newTodo, oldTodo) {
      expect(newTodo !== oldTodo)
      if (oldTodo && !newTodo) {
        // if the todo value we were referencing disappeared then remove the reference
        // from its parent
        detach(ref)
      }
    },
  })

  const list = new TodoList({
    list: [new Todo({ id: "a" }), new Todo({ id: "b" })],
    selectedRef: todoRef("b"),
  })
  expect(list.selectedTodo).toBe(list.list[1])

  // if we change the todo id then the ref should be gone
  list.list[1].setId("c")
  expect(list.list[1].id).toBe("c")
  expect(list.selectedTodo).toBe(undefined)
})

const countryRef2 = rootRef<Country>("countryRef2")

test("moving ref between roots", () => {
  const c1 = new Countries({
    countries: initialCountries(),
  })
  const c1Spain = c1.countries.spain

  const c2 = new Countries({
    countries: initialCountries(),
  })
  const c2Spain = c2.countries.spain

  const ref = countryRef(c1Spain)
  expect(ref.isValid).toBe(false)

  runUnprotected(() => {
    c1.selectedCountryRef = ref
  })
  expect(c1.selectedCountryRef!.current).toBe(c1Spain)
  expect(c2.selectedCountryRef).toBe(undefined)

  // switch to c2
  runUnprotected(() => {
    c1.selectedCountryRef = undefined
    c2.selectedCountryRef = ref
  })
  expect(c2.selectedCountryRef!.current).toBe(c2Spain)
  expect(c1.selectedCountryRef).toBe(undefined)

  // switch back to c1
  runUnprotected(() => {
    c2.selectedCountryRef = undefined
    c1.selectedCountryRef = ref
  })
  expect(c2.selectedCountryRef).toBe(undefined)
  expect(c1.selectedCountryRef!.current).toBe(c1Spain)
})

test("detached ref does not return stale cached target", () => {
  const c = new Countries({
    countries: initialCountries(),
  })

  const ref = countryRef2(c.countries.spain)

  runUnprotected(() => {
    c.selectedCountryRef = ref
  })

  // ref resolves successfully, seeding the internal cachedTarget
  expect(ref.current).toBe(c.countries.spain)

  // detach the ref from its parent tree
  runUnprotected(() => {
    c.selectedCountryRef = undefined
  })

  // ref is now its own root (detached); must return undefined, not the stale cache
  expect(ref.maybeCurrent).toBe(undefined)
  expect(ref.isValid).toBe(false)

  // re-attaching to the same root should resolve again
  runUnprotected(() => {
    c.selectedCountryRef = ref
  })
  expect(ref.current).toBe(c.countries.spain)
})

test("ref created from a detached object still resolves by id in the attached root", () => {
  const externalSpain = new Country({
    id: "spain",
    weather: "external",
  })

  const c = new Countries({
    countries: initialCountries(),
  })

  const ref = countryRef2(externalSpain)

  expect(ref.isValid).toBe(false)

  runUnprotected(() => {
    c.selectedCountryRef = ref
  })

  expect(ref.current).toBe(c.countries.spain)
  expect(ref.current).not.toBe(externalSpain)
})

test("ref can resolve to a replacement object with the same id", () => {
  const c = new Countries({
    countries: initialCountries(),
  })

  const originalSpain = c.countries.spain
  const ref = countryRef2(originalSpain)

  runUnprotected(() => {
    c.selectedCountryRef = ref
  })

  expect(ref.current).toBe(originalSpain)

  c.removeCountry("spain")

  const replacementSpain = new Country({
    id: "spain",
    weather: "cloudy",
  })
  c.addCountry(replacementSpain)

  expect(ref.current).toBe(replacementSpain)
  expect(ref.current).not.toBe(originalSpain)
})

test("string-created rootRef using getRefId stops resolving when the target id changes", () => {
  const c = new Countries({
    countries: initialCountries(),
  })

  const ref = countryRef2("spain")

  runUnprotected(() => {
    c.selectedCountryRef = ref
  })

  expect(ref.current).toBe(c.countries.spain)

  c.countries.spain.setId("iberia")

  expect(ref.maybeCurrent).toBe(undefined)
})

test("string-created rootRef participates in backrefs without prior observation", () => {
  const c = new Countries({
    countries: initialCountries(),
  })
  const cSpain = c.countries.spain
  const ref = countryRef2("spain")

  runUnprotected(() => {
    c.selectedCountryRef = ref
  })

  expect(Array.from(getRefsResolvingTo(cSpain, countryRef2))).toEqual([ref])

  c.removeCountry("spain")
  expect(Array.from(getRefsResolvingTo(cSpain, countryRef2))).toEqual([])

  c.addCountry(cSpain)
  expect(Array.from(getRefsResolvingTo(cSpain, countryRef2))).toEqual([ref])
})

test("queried rootRef backrefs set stays reactive without re-querying", () => {
  const c = new Countries({
    countries: initialCountries(),
  })
  const cSpain = c.countries.spain
  const ref = countryRef2(cSpain)

  runUnprotected(() => {
    c.selectedCountryRef = ref
  })

  const backRefs = getRefsResolvingTo(cSpain, countryRef2)
  const snapshots: Ref<Country>[][] = []

  autoDispose(
    reaction(
      () => Array.from(backRefs.values()),
      (refs) => {
        snapshots.push(refs)
      },
      { fireImmediately: true }
    )
  )

  c.removeCountry("spain")
  c.addCountry(cSpain)

  expect(snapshots).toEqual([[ref], [], [ref]])
})

test("rootRef onResolvedValueChange cleanup works without observing the ref first", () => {
  const c = new Countries({
    countries: initialCountries(),
  })
  const ref = countryRef(c.countries.spain)

  runUnprotected(() => {
    c.selectedCountryRef = ref
  })

  c.removeCountry("spain")

  expect(c.selectedCountryRef).toBeUndefined()
  expect(getParent(ref)).toBeUndefined()
})

test("default rootRef resolves empty string ids", () => {
  @testModel("EmptyIdTodo")
  class EmptyIdTodo extends Model({
    id: prop<string>(),
  }) {
    getRefId() {
      return this.id
    }
  }

  @testModel("EmptyIdRoot")
  class EmptyIdRoot extends Model({
    todo: prop<EmptyIdTodo>(),
    selectedTodoRef: prop<Ref<EmptyIdTodo> | undefined>(),
  }) {}

  const todoRef = rootRef<EmptyIdTodo>("emptyIdTodoRef")

  const root = new EmptyIdRoot({
    todo: new EmptyIdTodo({ id: "" }),
    selectedTodoRef: todoRef(""),
  })

  expect(root.selectedTodoRef!.current).toBe(root.todo)
})

test("untracked resolution of many rootRefs does not rescan the tree per ref", () => {
  @testModel("UntrackedResolutionItem")
  class Item extends Model({ id: prop<string>() }) {}

  let getIdCalls = 0
  const itemRef = rootRef<Item>("untrackedResolutionItemRef", {
    getId(item) {
      getIdCalls++
      return item instanceof Item ? item.id : undefined
    },
  })

  @testModel("UntrackedResolutionRoot")
  class Root extends Model({
    items: prop<Item[]>(() => []),
    refs: prop<Ref<Item>[]>(() => []),
  }) {}

  const count = 200
  const items = Array.from({ length: count }, (_, i) => new Item({ id: `item${i}` }))
  const root = new Root({ items, refs: items.map((item) => itemRef(item)) })

  getIdCalls = 0
  root.refs.forEach((ref, i) => {
    expect(ref.current).toBe(items[i])
  })
  // One walk visits every node once; per-ref rescans would be ~count times that.
  expect(getIdCalls).toBeLessThan(count * 10)

  runUnprotected(() => {
    root.items[0].id = "renamed"
  })
  expect(root.refs[0].maybeCurrent).toBeUndefined()
  expect(root.refs[1].current).toBe(items[1])
})

describe("resolution", () => {
  test("backrefs", () => {
    const c = new Countries({
      countries: initialCountries(),
    })
    const cSpain = c.countries.spain

    const ref = countryRef2(cSpain)

    // wrap in computeds just to make sure it is ok
    const countryRefBackRefs = computed(() =>
      Array.from(getRefsResolvingTo(cSpain, countryRef).values())
    )
    const countryRef2BackRefs = computed(() =>
      Array.from(getRefsResolvingTo(cSpain, countryRef2).values())
    )
    const allBackRefs = computed(() => Array.from(getRefsResolvingTo(cSpain).values()))

    function checkBackRefs() {
      // this kind of ref is not being used, so should be empty always
      expect(countryRefBackRefs.get()).toEqual([])

      if (ref.maybeCurrent === cSpain) {
        expect(allBackRefs.get()).toEqual([ref])
        expect(countryRef2BackRefs.get()).toEqual([ref])
      } else {
        expect(allBackRefs.get()).toEqual([])
        expect(countryRef2BackRefs.get()).toEqual([])
      }
    }

    expect(ref.isValid).toBe(false)

    checkBackRefs()

    runUnprotected(() => {
      c.selectedCountryRef = ref
    })

    expect(ref.current).toBe(cSpain)

    checkBackRefs()

    c.removeCountry("spain")
    expect(ref.maybeCurrent).toBe(undefined)

    checkBackRefs()

    c.addCountry(cSpain)
    expect(ref.current).toBe(cSpain)

    checkBackRefs()
  })

  test("is reactive", () => {
    const c = new Countries({
      countries: initialCountries(),
    })
    const cSpain = c.countries.spain

    const ref = countryRef2(cSpain)

    let calls = 0
    let lastValue: any
    autoDispose(
      reaction(
        () => ref.maybeCurrent,
        (v) => {
          calls++
          lastValue = v
        },
        { fireImmediately: true }
      )
    )

    expect(calls).toBe(1)
    expect(lastValue).toBe(undefined)

    runUnprotected(() => {
      c.selectedCountryRef = ref
    })
    expect(calls).toBe(2)
    expect(lastValue).toBe(cSpain)

    c.removeCountry("spain")
    expect(calls).toBe(3)
    expect(lastValue).toBe(undefined)

    c.addCountry(cSpain)
    expect(calls).toBe(4)
    expect(lastValue).toBe(cSpain)
  })
})

test("isRefOfType", () => {
  const c = new Countries({
    countries: initialCountries(),
  })
  const cSpain = c.countries.spain

  const ref = countryRef(cSpain)
  const ref2 = countryRef2(cSpain)

  expect(isRefOfType(ref, countryRef)).toBe(true)
  expect(isRefOfType(ref2, countryRef)).toBe(false)
  expect(isRefOfType(ref, countryRef2)).toBe(false)
  expect(isRefOfType(ref2, countryRef2)).toBe(true)

  // check generic is ok
  const refObj = ref as Ref<object>
  expect(isRefOfType(refObj, countryRef)).toBe(true)
})

test("getRefsResolvingTo after loading from snapshot", () => {
  @testModel("#56/Root")
  class Root extends Model({
    a: prop<A>(),
    b: prop<B>(),
  }) {}

  @testModel("#56/A")
  class A extends Model({
    [modelIdKey]: idProp,
  }) {
    @computed
    public get bs(): B[] {
      return Array.from(getRefsResolvingTo(this), (ref) => getParent<B>(ref)!)
    }
  }

  @testModel("#56/B")
  class B extends Model({
    [modelIdKey]: idProp,
    a: prop<Ref<A>>(),
  }) {}

  const aRef = rootRef<A>("aRef")

  const a = new A({})
  const b = new B({ a: aRef(a) })
  const root = new Root({ a, b })
  expect([...getRefsResolvingTo(root.a)]).toEqual([root.b.a])
  expect(root.a.bs).toHaveLength(1)
  expect(root.a.bs[0]).toBe(root.b)

  const newRoot = fromSnapshot(Root, getSnapshot(root))
  expect([...getRefsResolvingTo(newRoot.a)]).toEqual([newRoot.b.a])
  expect(newRoot.a.bs).toHaveLength(1)
  expect(newRoot.a.bs[0]).toBe(newRoot.b)
})

test("applySnapshot - applyPatches - ref", () => {
  const bRef = rootRef<B>("bRef", {
    onResolvedValueChange(_, next, prev) {
      expect(next !== prev)
      if (prev && !next) {
        detach(prev)
      }
    },
  })

  @testModel("A")
  class A extends Model({
    [modelIdKey]: idProp,
    b: prop<Ref<B>>(),
  }) {}

  @testModel("B")
  class B extends Model({
    [modelIdKey]: idProp,
    x: prop<number>(),
  }) {}

  @testModel("R")
  class R extends Model({
    as: prop<A[]>(),
    bs: prop<B[]>(),
  }) {
    @modelAction
    moveToEnd(index: number) {
      const a = this.as.splice(index, 1)[0]
      this.as.push(a)
    }
  }

  const b1 = new B({ x: 1 })
  const a1 = new A({ b: bRef(b1) })
  const b2 = new B({ x: 2 })
  const a2 = new A({ b: bRef(b2) })
  const ro = new R({ as: [a1, a2], bs: [b1, b2] })
  const rc = clone(ro, { generateNewIds: false })
  const rp = clone(ro, { generateNewIds: false })
  const rs = clone(ro, { generateNewIds: false })

  // record patches and take a snapshot
  const patches: Patch[][] = []
  autoDispose(
    onPatches(ro, (p) => {
      patches.push(p)
    })
  )
  ro.moveToEnd(0)

  const nofPatches = patches.length
  expect(patches).toMatchInlineSnapshot(`
    [
      [
        {
          "op": "remove",
          "path": [
            "as",
            0,
          ],
        },
      ],
      [
        {
          "op": "add",
          "path": [
            "as",
            1,
          ],
          "value": {
            "$modelId": "id-2",
            "$modelType": "applySnapshot - applyPatches - ref/A",
            "b": {
              "$modelType": "bRef",
              "id": "id-1",
            },
          },
        },
      ],
    ]
  `)

  const snapshot = getSnapshot(ro)

  expect(patches.length).toBe(nofPatches)
  expect(ro.as).toHaveLength(2)
  expect(ro.bs).toHaveLength(2)

  // work over clone
  expect(rc.as[0].b.maybeCurrent).toBe(rc.bs[0])
  expect(rc.as[1].b.maybeCurrent).toBe(rc.bs[1])
  rc.moveToEnd(0)

  expect(patches.length).toBe(nofPatches)
  expect(rc.as).toHaveLength(2)
  expect(rc.bs).toHaveLength(2)
  expect(rc.as[0].b.maybeCurrent).toBe(rc.bs[1])
  expect(rc.as[1].b.maybeCurrent).toBe(rc.bs[0])

  // apply patches
  expect(rp.as[0].b.maybeCurrent).toBe(rp.bs[0])
  expect(rp.as[1].b.maybeCurrent).toBe(rp.bs[1])
  applyPatches(rp, patches)

  expect(patches.length).toBe(nofPatches)
  expect(rp.as).toHaveLength(2)
  expect(rp.bs).toHaveLength(2)
  expect(rp.as[0].b.maybeCurrent).toBe(rp.bs[1])
  expect(rp.as[1].b.maybeCurrent).toBe(rp.bs[0])

  // apply snapshot
  expect(rs.as[0].b.maybeCurrent).toBe(rs.bs[0])
  expect(rs.as[1].b.maybeCurrent).toBe(rs.bs[1])
  applySnapshot(rs, snapshot)

  expect(patches.length).toBe(nofPatches)
  expect(rs.as).toHaveLength(2)
  expect(rs.bs).toHaveLength(2)
  expect(rs.as[0].b.maybeCurrent).toBe(rs.bs[1])
  expect(rs.as[1].b.maybeCurrent).toBe(rs.bs[0])
})

test("undo manager can undo removal of a referenced object in a single step", () => {
  const c = new Countries({
    countries: initialCountries(),
  })

  const manager = undoMiddleware(c)
  autoDispose(() => {
    manager.dispose()
  })

  const spain = c.countries.spain
  c.setSelectedCountry(spain)

  expect(manager.undoQueue).toMatchInlineSnapshot(`
    [
      {
        "actionName": "setSelectedCountry",
        "attachedState": {
          "afterEvent": undefined,
          "beforeEvent": undefined,
        },
        "inversePatches": [
          {
            "op": "replace",
            "path": [
              "selectedCountryRef",
            ],
            "value": undefined,
          },
        ],
        "patches": [
          {
            "op": "replace",
            "path": [
              "selectedCountryRef",
            ],
            "value": {
              "$modelType": "countryRef",
              "id": "spain",
            },
          },
        ],
        "targetPath": [],
        "type": "single",
      },
    ]
  `)
  expect(manager.redoQueue).toMatchInlineSnapshot(`[]`)
  manager.clearUndo()
  manager.clearRedo()

  // remove referenced country
  c.removeCountry("spain")
  expect(manager.undoQueue).toMatchInlineSnapshot(`
    [
      {
        "actionName": "removeCountry",
        "attachedState": {
          "afterEvent": undefined,
          "beforeEvent": undefined,
        },
        "inversePatches": [
          {
            "op": "add",
            "path": [
              "countries",
              "spain",
            ],
            "value": {
              "$modelType": "Country",
              "id": "spain",
              "weather": "sunny",
            },
          },
          {
            "op": "add",
            "path": [
              "selectedCountryRef",
            ],
            "value": {
              "$modelType": "countryRef",
              "id": "spain",
            },
          },
        ],
        "patches": [
          {
            "op": "remove",
            "path": [
              "countries",
              "spain",
            ],
          },
          {
            "op": "remove",
            "path": [
              "selectedCountryRef",
            ],
          },
        ],
        "targetPath": [],
        "type": "single",
      },
    ]
  `)
  expect(manager.redoQueue).toMatchInlineSnapshot(`[]`)

  expect(c.selectedCountryRef?.maybeCurrent).toBe(undefined)
})

test("backrefs can be updated in the middle of an action if the target and ref are under the same root", () => {
  const c = new Countries({
    countries: initialCountries(),
  })
  const cSpain = c.countries.spain

  c.setSelectedCountryRef(countryRef2(cSpain))
  const ref = c.selectedCountryRef!

  expect(getRoot(cSpain)).toBe(c)
  expect(getRoot(ref)).toBe(c)

  c.removeCountry("spain")

  runInAction(() => {
    // double calls are on purpose
    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )
    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )

    c.addCountry(cSpain)

    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      true
    )
    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      true
    )

    c.removeCountry("spain")

    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )
    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )

    c.addCountry(cSpain)

    expect(
      getRefsResolvingTo(cSpain, countryRef2, {
        updateAllRefsIfNeeded: true,
      }).has(ref)
    ).toBe(true)
    expect(
      getRefsResolvingTo(cSpain, countryRef2, {
        updateAllRefsIfNeeded: true,
      }).has(ref)
    ).toBe(true)

    // now remove and readd the reference
    c.setSelectedCountryRef(undefined)

    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )
    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )

    c.setSelectedCountryRef(ref)

    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      true
    )
    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      true
    )

    c.setSelectedCountryRef(undefined)

    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )
    expect(getRefsResolvingTo(cSpain, undefined, { updateAllRefsIfNeeded: true }).has(ref)).toBe(
      false
    )

    c.setSelectedCountryRef(ref)

    expect(
      getRefsResolvingTo(cSpain, countryRef2, {
        updateAllRefsIfNeeded: true,
      }).has(ref)
    ).toBe(true)
    expect(
      getRefsResolvingTo(cSpain, countryRef2, {
        updateAllRefsIfNeeded: true,
      }).has(ref)
    ).toBe(true)
  })
})

test("generic typings", () => {
  @testModel("GenericModel")
  class GenericModel<T1, T2> extends Model(<U1, U2>() => ({
    [modelIdKey]: idProp,
    v1: prop<U1 | undefined>(),
    v2: prop<U2>(),
    v3: prop<number>(0),
  }))<T1, T2> {}

  const genericRef = rootRef<GenericModel<any, any>>("genericRef")

  const ref = genericRef(new GenericModel({ v1: 1, v2: "2" }))
  expectTypeOf(ref).toEqualTypeOf<Ref<GenericModel<number, string>>>()

  const genericRef2 = rootRef<GenericModel<string, number>>("genericRef2")

  genericRef2(
    // @ts-expect-error - wrong type
    new GenericModel({ v1: 1, v2: "2" })
  )
})

test("issue #456", () => {
  @testModel("issue #456/Todo")
  class Todo extends Model({
    id: idProp,
    text: tProp(types.string, ""),
  }) {}

  const todoRef = rootRef<Todo>("issue #456/TodoRef")

  @testModel("issue #456/TodoList")
  class TodoList extends Model({
    todos: tProp(types.array(Todo)),
    selectedRef: tProp(types.ref(todoRef)),
    selectedRefs: tProp(types.array(types.ref(todoRef))),
  }) {}

  const todoList = new TodoList({
    todos: [new Todo({ id: "todo1" })],
    selectedRef: todoRef("todo1"),
    selectedRefs: [todoRef("todo1")],
  })

  const patches: Patch[][] = []

  onPatches(todoList, (p) => patches.push(p))
  const sn = getSnapshot(todoList)
  applySnapshot(todoList, sn)

  expect(patches).toHaveLength(0)
})

describe("model ref id index", () => {
  @testModel("refIdIndex/Item")
  class Item extends Model({
    id: idProp,
    children: prop<Item[]>(() => []),
  }) {
    @modelAction
    setId(id: string) {
      this.id = id
    }
  }

  @testModel("refIdIndex/CustomItem")
  class CustomItem extends Model({
    code: prop<string>(),
  }) {
    getRefId() {
      return this.code
    }
  }

  const itemRef = rootRef<Item | CustomItem>("refIdIndex/ItemRef")

  @testModel("refIdIndex/Store")
  class Store extends Model({
    id: idProp,
    items: prop<(Item | CustomItem)[]>(() => []),
    ref: prop<Ref<Item | CustomItem> | undefined>(),
  }) {}

  let lastDisposer: ReturnType<typeof autorun>
  const observeRef = (store: Store) => {
    const seen: unknown[] = []
    lastDisposer = autorun(() => seen.push(store.ref!.maybeCurrent))
    autoDispose(lastDisposer)
    return seen
  }

  const firstItem = (store: Store) => store.items[0] as Item

  const countDependencies = (tree: IDependencyTree): number =>
    1 + (tree.dependencies ?? []).reduce((acc, d) => acc + countDependencies(d), 0)

  test("a dangling ref only reacts to changes of its own id", () => {
    const store = new Store({
      items: Array.from({ length: 50 }, (_, i) => new Item({ id: `i${i}` })),
      ref: itemRef("x"),
    })
    const seen = observeRef(store)
    expect(seen).toEqual([undefined])
    // it must not depend on every item in the tree
    expect(countDependencies(getDependencyTree(lastDisposer))).toBeLessThan(30)

    runUnprotected(() => {
      store.items.push(new Item({ id: "b" }))
      firstItem(store).children.push(new Item({ id: "c" }))
      store.items.shift()
    })
    expect(seen).toEqual([undefined])

    const x = new Item({ id: "x" })
    runUnprotected(() => {
      firstItem(store).children.push(x)
    })
    expect(seen).toEqual([undefined, x])

    runUnprotected(() => {
      store.items.push(new Item({ id: "d" }))
    })
    expect(seen).toEqual([undefined, x])

    runUnprotected(() => {
      firstItem(store).children.pop()
    })
    expect(seen).toEqual([undefined, x, undefined])
  })

  test("id changes resolve and unresolve refs", () => {
    const item = new Item({ id: "a" })
    const store = new Store({ items: [item], ref: itemRef("x") })
    const seen = observeRef(store)

    item.setId("x")
    expect(seen).toEqual([undefined, item])

    item.setId("y")
    expect(seen).toEqual([undefined, item, undefined])
    expect(store.ref!.maybeCurrent).toBeUndefined()
  })

  test("the root and duplicated ids keep walk precedence", () => {
    const first = new Item({ id: "dup" })
    const second = new Item({ id: "dup" })
    const store = new Store({ items: [first, second], ref: itemRef("dup") })
    const seen = observeRef(store)
    // the later sibling wins
    expect(seen).toEqual([second])

    runUnprotected(() => {
      store.items.pop()
    })
    expect(seen).toEqual([second, first])

    // the root wins over its descendants
    const rootLike = new Store({ id: "root", items: [new Item({ id: "root" })] })
    runUnprotected(() => {
      rootLike.ref = itemRef("root")
    })
    expect(rootLike.ref!.maybeCurrent).toBe(rootLike)
  })

  test("models with a custom getRefId are resolved", () => {
    const store = new Store({ items: [new Item({ id: "a" })], ref: itemRef("custom") })
    const seen = observeRef(store)

    const custom = new CustomItem({ code: "custom" })
    runUnprotected(() => {
      store.items.push(custom)
    })
    expect(seen).toEqual([undefined, custom])

    runUnprotected(() => {
      custom.code = "other"
    })
    expect(seen).toEqual([undefined, custom, undefined])

    // back to the index once the custom model is gone
    const a = store.items[0] as Item
    runUnprotected(() => {
      store.items.pop()
      a.id = "custom"
    })
    expect(seen).toEqual([undefined, custom, undefined, a])
  })
})

describe("custom ref id index", () => {
  @testModel("customRefIdIndex/Item")
  class Item extends Model({
    code: prop<string>(),
  }) {}

  let getIdCalls = 0
  const getCode = (target: object) => {
    getIdCalls++
    return target instanceof Item ? target.code : undefined
  }
  const itemRef = rootRef<Item>("customRefIdIndex/ItemRef", { getId: getCode })

  @testModel("customRefIdIndex/Store")
  class Store extends Model({
    items: prop<Item[]>(() => []),
    ref: prop<Ref<Item> | undefined>(),
  }) {}

  const observeRef = (store: Store) => {
    const seen: unknown[] = []
    autoDispose(autorun(() => seen.push(store.ref!.maybeCurrent)))
    return seen
  }

  const countDependencies = (tree: IDependencyTree): number =>
    1 + (tree.dependencies ?? []).reduce((acc, d) => acc + countDependencies(d), 0)

  const createStore = (count: number, ref: string) =>
    new Store({
      items: Array.from({ length: count }, (_, i) => new Item({ code: `i${i}` })),
      ref: itemRef(ref),
    })

  test("dangling refs resolve and unresolve as items are added, removed or renamed", () => {
    const store = createStore(500, "x")
    const seen = observeRef(store)
    expect(seen).toEqual([undefined])

    const x = new Item({ code: "x" })
    runUnprotected(() => {
      store.items.splice(300, 0, x)
    })
    expect(seen).toEqual([undefined, x])

    runUnprotected(() => {
      x.code = "y"
    })
    expect(seen).toEqual([undefined, x, undefined])

    const item = store.items[400]
    runUnprotected(() => {
      item.code = "x"
      // consistent inside the action too
      expect(store.ref!.maybeCurrent).toBe(item)
    })
    expect(seen).toEqual([undefined, x, undefined, item])

    runUnprotected(() => {
      store.items.splice(400, 1)
      expect(store.ref!.maybeCurrent).toBeUndefined()
    })
    expect(seen).toEqual([undefined, x, undefined, item, undefined])
  })

  test("changes only re-read the ids of one chunk", () => {
    const store = createStore(1000, "x")
    const disposer = autorun(() => store.ref!.maybeCurrent)
    autoDispose(disposer)
    // one id read per item, without a per-node aggregate (~3 per item)
    expect(countDependencies(getDependencyTree(disposer))).toBeLessThan(1500)

    getIdCalls = 0
    runUnprotected(() => {
      store.items.push(new Item({ code: "a" }))
    })
    // one chunk, plus the root
    expect(getIdCalls).toBeLessThanOrEqual(129)

    getIdCalls = 0
    runUnprotected(() => {
      store.items[500].code = "b"
    })
    // one chunk, plus the root
    expect(getIdCalls).toBeLessThanOrEqual(129)
  })

  test("mostly empty chunks are merged or dropped", () => {
    const store = createStore(1000, "x")
    const seen = observeRef(store)
    const disposer = autorun(() => store.ref!.maybeCurrent)
    autoDispose(disposer)

    const findIndex = (tree: IDependencyTree): IDependencyTree | undefined =>
      tree.name.includes("refIdIndex")
        ? tree
        : (tree.dependencies ?? []).map(findIndex).find((t) => t !== undefined)
    // one dependency per chunk, plus the chunks atom
    const chunkCount = () => findIndex(getDependencyTree(disposer))!.dependencies!.length - 1
    expect(chunkCount()).toBe(8)

    runUnprotected(() => {
      store.items.splice(0, 900)
    })
    expect(chunkCount()).toBeLessThanOrEqual(2)

    // items of dropped chunks are gone from the index
    expect(resolveId(store, "i5", getCode)).toBeUndefined()

    const item = store.items[50]
    runUnprotected(() => {
      item.code = "x"
    })
    expect(seen).toEqual([undefined, item])

    runUnprotected(() => {
      item.code = "y"
      store.items.push(new Item({ code: "x" }))
    })
    expect(seen).toEqual([undefined, item, store.items[100]])
  })

  test("duplicated ids keep walk precedence", () => {
    const first = new Item({ code: "dup" })
    const second = new Item({ code: "dup" })
    const store = createStore(300, "dup")
    runUnprotected(() => {
      store.items.splice(10, 0, first)
      store.items.push(second)
    })
    const seen = observeRef(store)
    // the later sibling wins
    expect(seen).toEqual([second])

    runUnprotected(() => {
      store.items.pop()
    })
    expect(seen).toEqual([second, first])
  })

  test("untracked resolution follows changes", () => {
    const store = createStore(500, "x")
    expect(store.ref!.maybeCurrent).toBeUndefined()

    const item = store.items[200]
    runUnprotected(() => {
      item.code = "x"
    })
    expect(store.ref!.maybeCurrent).toBe(item)

    runUnprotected(() => {
      store.items.splice(0, 300)
    })
    expect(store.ref!.maybeCurrent).toBeUndefined()
  })

  test("resolution matches a tree walk after random changes", () => {
    const store = createStore(300, "c0")
    const seen = observeRef(store)
    let seed = 1
    const random = (max: number) => {
      seed = (seed * 16807) % 2147483647
      return seed % max
    }
    const randomCode = () => `c${random(400)}`

    for (let i = 0; i < 1000; i++) {
      runUnprotected(() => {
        const op = random(5)
        if (op === 0) store.items.push(new Item({ code: randomCode() }))
        else if (op === 1)
          store.items.splice(random(store.items.length + 1), 0, new Item({ code: randomCode() }))
        else if (op === 2 && store.items.length > 0)
          store.items.splice(random(store.items.length), 1 + random(3))
        else if (store.items.length > 0) store.items[random(store.items.length)].code = randomCode()
        if (random(10) === 0) store.ref = itemRef(randomCode())
      })
      const matches = store.items.filter((item) => item.code === store.ref!.id)
      const resolved = store.ref!.maybeCurrent
      expect(seen[seen.length - 1]).toBe(resolved)
      if (matches.length <= 1) {
        expect(resolved).toBe(matches[0])
      } else {
        // a ref keeps its previous target while it still matches
        expect(matches).toContain(resolved)
      }
    }
  })

  test("resolution matches a tree walk while chunks are merged and dropped", () => {
    const store = createStore(1000, "c0")
    const seen = observeRef(store)
    let seed = 7
    const random = (max: number) => {
      seed = (seed * 16807) % 2147483647
      return seed % max
    }
    // few codes, so most are duplicated across chunks
    const randomCode = () => `c${random(20)}`
    runUnprotected(() => {
      store.items.forEach((item) => {
        item.code = randomCode()
      })
    })

    for (let i = 0; i < 600; i++) {
      // alternately shrink the items to a few and grow them back
      const shrinking = Math.floor(i / 150) % 2 === 0
      runUnprotected(() => {
        const op = random(4)
        if (op === 0 && store.items.length > 0) {
          const count = shrinking ? 1 + random(60) : 1
          store.items.splice(random(store.items.length), count)
        } else if (op === 1) {
          const count = shrinking ? 1 : 1 + random(60)
          const added = Array.from({ length: count }, () => new Item({ code: randomCode() }))
          store.items.splice(random(store.items.length + 1), 0, ...added)
        } else if (op === 2 && store.items.length > 0) {
          store.items[random(store.items.length)].code = randomCode()
        } else {
          store.ref = itemRef(randomCode())
        }
      })
      const matches = store.items.filter((item) => item.code === store.ref!.id)
      const resolved = store.ref!.maybeCurrent
      expect(seen[seen.length - 1]).toBe(resolved)
      if (matches.length <= 1) {
        expect(resolved).toBe(matches[0])
      } else {
        expect(matches).toContain(resolved)
      }
      if (i % 10 === 0) {
        for (let c = 0; c < 20; c++) {
          const code = `c${c}`
          const found = resolveId(store, code, getCode)
          const all = store.items.filter((item) => item.code === code)
          if (all.length === 0) {
            expect(found).toBeUndefined()
          } else {
            expect(all).toContain(found)
          }
        }
      }
    }
  })
})
