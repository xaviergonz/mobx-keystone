import { LoroDoc, LoroMap } from "loro-crdt"
import {
  getGlobalConfig,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("typed multi-key events stop native changed-value reads after two differences", () => {
  @testModel("bulk-native-reads")
  class Root extends Model({ values: tProp(types.record(types.number), () => ({})) }) {}
  expect(getGlobalConfig().modelAutoTypeChecking).toBe(ModelAutoTypeCheckingMode.AlwaysOn)
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const values = root.get("values") as LoroMap
  const incoming = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`value${i}`, i]))
  for (const [key, value] of Object.entries(incoming)) values.set(key, value)
  const get = vi.spyOn(LoroMap.prototype, "get")
  try {
    doc.commit()
    expect(
      get.mock.calls.filter(
        ([key]) => typeof key === "string" && key.startsWith("value") && key !== "values"
      ).length
    ).toBeLessThanOrEqual(3)
    expect(getSnapshot(binding.boundObject.values)).toEqual(incoming)
  } finally {
    get.mockRestore()
  }
})
