import { remove, set } from "mobx"
import {
  getGlobalConfig,
  Model,
  ModelAutoTypeCheckingMode,
  runUnprotected,
  setGlobalConfig,
  tProp,
  types,
} from "../../src"
import { testModel } from "../utils"

test("shape edits preserve cached checks for unrelated values", () => {
  let checks = 0
  @testModel("shape-change-caching")
  class PerfRoot extends Model({
    large: tProp(
      types.array(
        types.refinement(types.number, () => {
          checks++
          return true
        })
      )
    ),
    small: tProp(types.record(types.number), () => ({})),
  }) {}
  const previous = getGlobalConfig().modelAutoTypeChecking
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
  try {
    const root = new PerfRoot({ large: Array.from({ length: 10000 }, () => 1) })
    checks = 0
    runUnprotected(() => {
      set(root.small, "a", 1)
      set(root.small, "b", 2)
      remove(root.small, "a")
      remove(root.small, "b")
    })
    expect(checks).toBe(0)
  } finally {
    setGlobalConfig({ modelAutoTypeChecking: previous })
  }
})
