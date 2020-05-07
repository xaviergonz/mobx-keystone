import { computed, get, reaction, remove, set } from "mobx"
import {
  clone,
  customRef,
  detach,
  findParent,
  getParent,
  getParentPath,
  getSnapshot,
  isRefOfType,
  model,
  Model,
  modelAction,
  prop,
  Ref,
  runUnprotected,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

interface Country {
  weather: string
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
  addCountry(id: string, c: Country) {
    set(this.countries, id, c)
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

const countryRef = customRef<Country>("countryRef", {
  resolve(ref) {
    const countriesParent = findParent<Countries>(ref, n => n instanceof Countries)
    if (!countriesParent) return undefined
    // this is valid in mobx5 but not mobx4
    // return countriesParent.countries[ref.id]
    return get(countriesParent.countries, ref.id)
  },

  getId(target) {
    const targetParentPath = getParentPath<Countries>(target)
    return "" + targetParentPath!.path
  },

  onResolvedValueChange(ref, newValue, oldValue) {
    expect(newValue !== oldValue)
    if (oldValue && !newValue) {
      detach(ref)
    }
  },
})

const initialCountries: () => { [k: string]: Country } = () => ({
  spain: {
    weather: "sunny",
  },
  uk: {
    weather: "rainy",
  },
  france: {
    weather: "soso",
  },
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
      "$modelId": "id-2",
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
        "$modelId": "id-2",
        "$modelType": "countryRef",
        "id": "spain",
      },
      Object {
        "$modelId": "id-3",
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

test("single selection with getRefId", () => {
  @model("myApp/Todo")
  class Todo extends Model({ id: prop<string>() }) {
    getRefId() {
      return this.id
    }

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
    selectTodo(todo: Todo | undefined) {
      if (todo && !this.list.includes(todo)) throw new Error("unknown todo")
      this.selectedRef = todo ? todoRef(todo) : undefined
    }
  }

  const todoRef = customRef<Todo>("myApp/TodoRef", {
    // not needed since we will use `getRefId()` on the model class instead
    // getId(todo) {
    //   return todo.id
    // },

    resolve(ref) {
      // get the todo list where this ref is
      const todoList = findParent<TodoList>(ref, n => n instanceof TodoList)
      // if the ref is not yet attached then it cannot be resolved
      if (!todoList) return undefined
      // but if it is attached then try to find it
      return todoList.list.find(todo => todo.id === ref.id)
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

const countryRef2 = customRef<Country>("countryRef2", {
  resolve(ref) {
    const countriesParent = findParent<Countries>(ref, n => n instanceof Countries)
    if (!countriesParent) return undefined
    // this is valid in mobx5 but not mobx4
    // return countriesParent.countries[ref.id]
    return get(countriesParent.countries, ref.id)
  },

  getId(target) {
    const targetParentPath = getParentPath<Countries>(target)
    return "" + targetParentPath!.path
  },
})

describe("resolution", () => {
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
        v => {
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

    c.addCountry("spain", cSpain)
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
