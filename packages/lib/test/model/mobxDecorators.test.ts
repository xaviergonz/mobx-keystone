import { autorun, isAction, isComputedProp, isObservableObject, isObservableProp } from "mobx"
import { DataModel, getMobxVersion, Model, prop } from "../../src"
import { testModel } from "../utils"
import { computeCalls } from "./fixtures/mobxDecoratorsCounter"

let usesStandardDecorators = false
function detectDecorators(...args: any[]) {
  usesStandardDecorators = typeof args[1] === "object"
}

class DecoratorProbe {
  @detectDecorators
  method() {}
}
void DecoratorProbe

const fixtures = usesStandardDecorators
  ? await import("./fixtures/mobxDecoratorsStandard")
  : await import("./fixtures/mobxDecoratorsLegacy")

// MobX 4/5 legacy field decorators need [[Set]] class field semantics, which only
// the babel setup of the test matrix provides, so not even plain classes work there
function plainClassWorks() {
  try {
    expectObservableFlag(new fixtures.Plain())
    expectCachedDouble(new fixtures.Plain())
    return true
  } catch {
    return false
  }
}
const mobxDecoratorsWork = plainClassWorks()

test("MobX decorators work in plain classes on MobX 6+", () => {
  expect(mobxDecoratorsWork || getMobxVersion() < 6).toBe(true)
})

function expectObservableFlag(obj: { flag: boolean; setFlag(flag: boolean): void }) {
  expect(isObservableProp(obj, "flag")).toBe(true)
  expect(isAction(obj.setFlag)).toBe(true)

  const values: boolean[] = []
  const dispose = autorun(() => {
    values.push(obj.flag)
  })
  obj.setFlag(true)
  dispose()
  expect(values).toEqual([false, true])
}

function expectCachedDouble(obj: { double: number }) {
  expect(isComputedProp(obj, "double")).toBe(true)

  computeCalls.count = 0
  const dispose = autorun(() => {
    obj.double
    obj.double
  })
  dispose()
  expect(computeCalls.count).toBe(1)
}

test.runIf(mobxDecoratorsWork)("MobX decorators work inside class models", () => {
  const { Base, Sub } = fixtures

  const base = new Base({})
  expectObservableFlag(base)
  expectCachedDouble(base)

  const sub = new Sub({})
  expectObservableFlag(sub)
  expectCachedDouble(sub)
  expect(isObservableProp(sub, "subFlag")).toBe(true)
  expect(isAction(sub.setSubFlag)).toBe(true)
  const values: boolean[] = []
  const dispose = autorun(() => {
    values.push(sub.subFlag)
  })
  sub.setSubFlag(true)
  dispose()
  expect(values).toEqual([false, true])
})

test.runIf(mobxDecoratorsWork)("MobX decorators work inside data models", () => {
  const { Data } = fixtures

  const data = new Data({ x: 1 })
  expectObservableFlag(data)
  expectCachedDouble(data)
})

test("models without MobX decorators are still reactive", () => {
  @testModel("mobxDecorators/Plain")
  class Plain extends Model({ x: prop(1).withSetter() }) {}

  @testModel("mobxDecorators/PlainData")
  class PlainData extends DataModel({ x: prop<number>() }) {}

  const plain = new Plain({})
  const plainData = new PlainData({ x: 1 })
  expect(isObservableObject(plain)).toBe(false)
  expect(isObservableObject(plainData)).toBe(false)

  const values: number[] = []
  const dispose = autorun(() => {
    values.push(plain.x + plainData.x)
  })
  plain.setX(2)
  dispose()
  expect(values).toEqual([2, 3])
})
