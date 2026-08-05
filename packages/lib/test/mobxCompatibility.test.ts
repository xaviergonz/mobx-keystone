import { autorun, isAction, isComputedProp, observable } from "mobx"
import { getMobxVersion, Model, mobxAction, mobxComputed, model } from "../src"

test("MobX compatibility decorators support methods and getters", () => {
  @model("mobxCompatibility/Store")
  class Store extends Model({}) {
    readonly value = observable.box(1)

    @mobxComputed
    get doubled(): number {
      return this.value.get() * 2
    }

    @mobxAction
    increment(): void {
      this.value.set(this.value.get() + 1)
    }
  }

  const store = new Store({})
  const values: number[] = []
  const dispose = autorun(() => {
    values.push(store.doubled)
  })

  expect(isAction(store.increment)).toBe(true)
  expect(values).toEqual([2])

  store.increment()
  expect(values).toEqual([2, 4])

  dispose()
})

test.runIf(getMobxVersion() >= 7)(
  "MobX 7 compatibility decorators support legacy decorator calls",
  () => {
    class Store {
      readonly value = observable.box(1)

      get doubled(): number {
        return this.value.get() * 2
      }

      increment(): void {
        this.value.set(this.value.get() + 1)
      }
    }

    const actionDescriptor = mobxAction(
      Store.prototype,
      "increment",
      Object.getOwnPropertyDescriptor(Store.prototype, "increment")!
    )
    if (actionDescriptor) {
      Object.defineProperty(Store.prototype, "increment", actionDescriptor)
    }

    const computedDescriptor = mobxComputed(
      Store.prototype,
      "doubled",
      Object.getOwnPropertyDescriptor(Store.prototype, "doubled")!
    )
    if (computedDescriptor) {
      Object.defineProperty(Store.prototype, "doubled", computedDescriptor)
    }

    const store = new Store()
    const values: number[] = []
    const dispose = autorun(() => {
      values.push(store.doubled)
    })

    expect(isAction(store.increment)).toBe(true)
    expect(store.increment.name).toBe("increment")
    expect(isComputedProp(store, "doubled")).toBe(false)
    expect(values).toEqual([2])

    store.increment()
    expect(values).toEqual([2, 4])

    dispose()
  }
)
