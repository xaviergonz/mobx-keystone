import { LoroDoc, LoroMovableList } from "loro-crdt"
import { DeepChangeType, Model, onDeepChange, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("reentrant primitive arrays avoid container-position scans", () => {
  @testModel("primitive-position-root")
  class Root extends Model({
    values: tProp(types.array(types.number), () => Array(1000).fill(0)),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  autoDispose(
    onDeepChange(binding.boundObject.values, (change) => {
      if (change.type === DeepChangeType.ArrayUpdate && change.newValue === 1)
        binding.boundObject.values[0] = 2
    })
  )
  const reads = vi.spyOn(LoroMovableList.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  runUnprotected(() => {
    binding.boundObject.values[0] = 1
  })
  expect(reads.mock.calls.length).toBeLessThanOrEqual(2)
  expect(binding.boundObject.values[0]).toBe(2)
  expect((root.get("values") as LoroMovableList).get(0)).toBe(2)
})
