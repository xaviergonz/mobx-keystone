import { computed } from "mobx"
import {
  clone,
  customRef,
  detach,
  findParent,
  getParent,
  getParentPath,
  getSnapshot,
  model,
  Model,
  modelAction,
  newModel,
  prop,
  Ref,
} from "../../src"
import "../commonSetup"

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
    delete this.countries[name]
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
    return countriesParent.countries[ref.id]
  },

  getId(target) {
    const targetParentPath = getParentPath<Countries>(target)
    return "" + targetParentPath!.path
  },

  onResolvedValueChange(ref, newValue, oldValue) {
    if (oldValue && !newValue) {
      detach(ref)
    }
  },
})

const initialCountries: { [k: string]: Country } = {
  spain: {
    weather: "sunny",
  },
  uk: {
    weather: "rainy",
  },
  france: {
    weather: "soso",
  },
}

test("single ref works", () => {
  const c = newModel(Countries, {
    countries: initialCountries,
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
  expect(cloneC.selectedCountry).toBe(cloneC.countries["spain"])

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
  const c = newModel(Countries, {
    countries: initialCountries,
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
