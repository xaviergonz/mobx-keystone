import { Model, TypeCheckError, tProp, typeCheck, types } from "../../src"
import { testModel } from "../utils"

@testModel("diagnostic-child")
class Child extends Model({ count: tProp(0) }) {}

test("union checking can reject a record branch before accepting a model branch", () => {
  const child = new Child({})
  const type = types.or(types.record(types.or(types.string, types.number)), Child)
  expect(typeCheck(type, child)).toBeNull()
})

test("type errors can describe model data objects", () => {
  const child = new Child({})
  const error = new TypeCheckError({
    path: [],
    expectedTypeName: "string",
    actualValue: child.$,
    typeCheckedValue: child.$,
  })
  expect(error.actualValue).toBe(child.$)
  expect(error.message).toContain("diagnostic-child")
  expect(error.message).toContain("count")
})
