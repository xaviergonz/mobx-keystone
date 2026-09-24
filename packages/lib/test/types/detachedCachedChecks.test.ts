import { runInAction, set } from "mobx"
import {
  getGlobalConfig,
  Model,
  ModelAutoTypeCheckingMode,
  runUnprotected,
  setGlobalConfig,
  tProp,
  types,
} from "../../src"
import { getMobxVersion } from "../../src/utils"
import { testModel } from "../utils"

@testModel("detachedCachedChecks/Root")
class Root extends Model({
  arr: tProp(types.array(types.number), () => []),
  rec: tProp(types.record(types.number), () => ({})),
}) {}

let previous: ModelAutoTypeCheckingMode
beforeEach(() => {
  previous = getGlobalConfig().modelAutoTypeChecking
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
})
afterEach(() => {
  setGlobalConfig({ modelAutoTypeChecking: previous })
})

// MobX 4 stores a new object when a detached one is assigned again
const testReattach = test.skipIf(getMobxVersion() === 4)

testReattach("changes made to a detached array are type-checked when it is attached again", () => {
  const root = new Root({ arr: Array.from({ length: 300 }, () => 1) })
  const arr = root.arr

  runUnprotected(() => {
    root.arr = []
  })
  runInAction(() => {
    ;(arr as any[]).push("x")
  })

  expect(() =>
    runUnprotected(() => {
      root.arr = arr
    })
  ).toThrow("Path: /arr/300")
})

testReattach("changes made to a detached record are type-checked when it is attached again", () => {
  const root = new Root({ rec: { a: 1 } })
  const rec = root.rec

  runUnprotected(() => {
    root.rec = {}
  })
  runInAction(() => {
    set(rec, "b", "x")
  })

  expect(() =>
    runUnprotected(() => {
      root.rec = rec
    })
  ).toThrow("Path: /rec/b")
})

testReattach(
  "cached checks follow the changes made after attaching a changed container again",
  () => {
    const root = new Root({ arr: Array.from({ length: 300 }, () => 1), rec: { a: 1 } })
    const { arr, rec } = root

    runUnprotected(() => {
      root.arr = []
      root.rec = {}
    })
    runInAction(() => {
      arr.unshift(2, 2)
      set(rec, "b", 2)
    })
    runUnprotected(() => {
      root.arr = arr
      root.rec = rec
    })

    expect(() =>
      runUnprotected(() => {
        ;(arr as any[])[301] = "x"
      })
    ).toThrow("Path: /arr/301")
    expect(() =>
      runUnprotected(() => {
        rec.b = "x" as any
      })
    ).toThrow("Path: /rec/b")
  }
)
