import { Model } from "../../src"
import { addModelClassInitializer } from "../../src/modelShared/modelClassInitializer"
import { testModel } from "../utils"

test("subclass initializers do not leak into the base or sibling classes", () => {
  class Base extends Model({}) {}

  @testModel("InitializerConcreteBase")
  class ConcreteBase extends Base {}

  @testModel("InitializerChild")
  class Child extends Base {}

  @testModel("InitializerSibling")
  class Sibling extends Base {}
  const calls: string[] = []

  addModelClassInitializer(Base, () => {
    calls.push("base")
  })

  addModelClassInitializer(Child, () => {
    calls.push("child")
  })

  new ConcreteBase({})
  expect(calls).toEqual(["base"])

  calls.length = 0
  new Sibling({})
  expect(calls).toEqual(["base"])

  calls.length = 0
  new Child({})
  expect(calls).toEqual(["base", "child"])
})
