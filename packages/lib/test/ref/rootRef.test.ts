import { computed, remove, set } from "mobx"
import {
  clone,
  detach,
  getParent,
  getSnapshot,
  model,
  Model,
  modelAction,
  prop,
  Ref,
  rootRef,
  runUnprotected,
} from "../../src"
import * as rootRefModule from "../../src/ref/rootRef"
import "../commonSetup"

@model("Country")
class Country extends Model({
  id: prop<string>(),
  weather: prop<string>(),
}) {
  getRefId() {
    return this.id
  }
}

@model("Countries")
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
    return this.selectedCountriesRef.map(r => r.current)
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
  setSelectedCountries(countries: Country[]) {
    this.selectedCountriesRef = countries.map(c => countryRef(c))
  }
}

const countryRef = rootRef<Country>("countryRef", {
  onResolvedValueChange(ref, newValue, oldValue) {
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
    Object {
      "$modelType": "countryRef",
      "id": "spain",
    }
  `)
  expect(r.isValid).toBe(true)
  expect(r.maybeCurrent).toBe(spain)
  expect(r.current).toBe(spain)

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
    Array [
      Object {
        "$modelType": "countryRef",
        "id": "spain",
      },
      Object {
        "$modelType": "countryRef",
        "id": "uk",
      },
    ]
  `)
  expect(r.map(rr => rr.isValid)).toEqual([true, true])
  expect(r.map(rr => rr.maybeCurrent)).toEqual([spain, uk])
  expect(r.map(rr => rr.current)).toEqual([spain, uk])

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
  @model("myApp/Todo")
  class Todo extends Model({ id: prop<string>() }) {
    @modelAction
    setId(id: string) {
      this.id = id
    }
  }

  @model("myApp/TodoList")
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
    selectTodo(todoId: string | undefined) {
      if (!todoId) {
        this.selectedRef = undefined
      } else {
        const todo = this.list.find(todo => todo.id === todoId)
        this.selectedRef = todoRef(todo!)
      }
    }
  }

  const todoRef = rootRef<Todo>("myApp/TodoRef", {
    getId(todo) {
      return todo instanceof Todo ? todo.id : undefined
    },

    onResolvedValueChange(ref, newTodo, oldTodo) {
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

describe("resolution is cached", () => {
  let resolveRefRootMock: jest.SpyInstance<object | undefined, any[]>

  beforeEach(() => {
    resolveRefRootMock = jest.spyOn(rootRefModule, "resolveRefRoot")
  })

  afterEach(() => {
    resolveRefRootMock.mockRestore()
  })

  test("is cached", () => {
    const c = new Countries({
      countries: initialCountries(),
    })
    const cSpain = c.countries["spain"]

    expect(resolveRefRootMock).not.toHaveBeenCalled()

    const ref = countryRef2(cSpain)
    expect(resolveRefRootMock).not.toHaveBeenCalled()

    // when not valid it should get called everytime
    expect(ref.isValid).toBe(false)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(1)
    expect(ref.isValid).toBe(false)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(2)

    runUnprotected(() => {
      c.selectedCountryRef = ref
    })
    expect(resolveRefRootMock).toHaveBeenCalledTimes(2)

    // once valid it should be only called once
    expect(ref.current).toBe(cSpain)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(3)
    expect(ref.current).toBe(cSpain)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(3)

    c.removeCountry("spain")
    expect(ref.maybeCurrent).toBe(undefined)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(4)
    expect(ref.maybeCurrent).toBe(undefined)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(5)

    c.addCountry(cSpain)
    expect(ref.current).toBe(cSpain)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(6)
    expect(ref.current).toBe(cSpain)
    expect(resolveRefRootMock).toHaveBeenCalledTimes(6)
  })
})
