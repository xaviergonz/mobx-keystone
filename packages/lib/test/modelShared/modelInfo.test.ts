import { fromSnapshot, getModelInfoForName, getSnapshot, Model, model } from "../../src"

test("unregistered names inherited from Object.prototype are not models", () => {
  expect(getModelInfoForName("constructor")).toBeUndefined()
  expect(getModelInfoForName("toString")).toBeUndefined()
  expect(() => fromSnapshot({ $modelType: "constructor" })).toThrow(/not found in the registry/)
})

test("registering __proto__ does not introduce other model registry entries", () => {
  @model("__proto__")
  class M extends Model({}) {}
  const instance = new M({})
  expect(fromSnapshot(getSnapshot(instance))).toBeInstanceOf(M)
  expect(getModelInfoForName("class")).toBeUndefined()
  expect(getModelInfoForName("name")).toBeUndefined()
})
