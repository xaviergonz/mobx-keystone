import { computed, reaction, remove, runInAction, set } from "mobx"
import { assert, _ } from "spec.ts"
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
  Patch,
  prop,
  Ref,
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
}

@testModel("Countries")
class Countries extends Model({
  countries: prop<{ [k: string]: Country }>(() => ({})),
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

const initialCountries: () => { [k: string]: Country } = () => ({
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

  const spain = c.countries["spain"]
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
  expect(cloneC.countries["spain"]).toBeTruthy()
  const cloneCSelectedCountry = cloneC.selectedCountry
  expect(cloneCSelectedCountry).toBe(cloneC.countries["spain"])

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
  expect(cloneC.selectedCountry).toBe(cloneC.countries["spain"])
})

test("array ref works", () => {
  const c = new Countries({
    countries: initialCountries(),
  })

  expect(c.selectedCountriesRef).toEqual([])
  expect(c.selectedCountries).toEqual([])

  const spain = c.countries["spain"]
  const uk = c.countries["uk"]
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
  expect(cloneC.countries["spain"]).toBeTruthy()
  expect(cloneC.countries["uk"]).toBeTruthy()
  expect(cloneC.selectedCountries).toEqual([cloneC.countries["spain"], cloneC.countries["uk"]])

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
  expect(cloneC.selectedCountries).toEqual([cloneC.countries["spain"], cloneC.countries["uk"]])
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
      if (todo && !this.list.includes(todo)) throw new Error("unknown todo")
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
  const c1Spain = c1.countries["spain"]

  const c2 = new Countries({
    countries: initialCountries(),
  })
  const c2Spain = c2.countries["spain"]

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

describe("resolution", () => {
  test("backrefs", () => {
    const c = new Countries({
      countries: initialCountries(),
    })
    const cSpain = c.countries["spain"]

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
    const cSpain = c.countries["spain"]

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
  const cSpain = c.countries["spain"]

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
  autoDispose(() => manager.dispose())

  const spain = c.countries["spain"]
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
  const cSpain = c.countries["spain"]

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
  assert(ref, _ as Ref<GenericModel<number, string>>)

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
