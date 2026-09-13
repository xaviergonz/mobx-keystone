import { applyAction, BuiltInAction, Model, prop } from "../../src"
import { testModel } from "../utils"

@testModel("ActionTargetStringConversion")
class Target extends Model({ value: prop(1) }) {
  toString(): string {
    throw new Error("target must not be stringified")
  }
}

test("applying an action does not stringify its target", () => {
  const root = new Target({})
  applyAction(root, {
    actionName: BuiltInAction.ApplySet,
    args: ["value", 2],
    targetPath: [],
    targetPathIds: [],
  })
  expect(root.value).toBe(2)
})
