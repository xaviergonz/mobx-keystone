import { Model, modelAction, modelFlow } from "../../src"
import { testModel } from "../utils"

@testModel("LegacyDecoratorDiagnostics")
class Item extends Model({}) {}

test.each([
  ["modelAction", modelAction],
  ["modelFlow", modelFlow],
] as const)("legacy %s symbol diagnostics name the invoked decorator", (name, decorator) => {
  expect(() =>
    decorator(Item.prototype, Symbol("method"), {
      value() {},
      configurable: true,
      writable: true,
    })
  ).toThrow(`@${name} cannot decorate symbol properties`)
})
