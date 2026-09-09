import { LoroDoc, LoroMovableList } from "loro-crdt"
import { getSnapshot, idProp, Model, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("pending native fields with unchanged model identity avoid unrelated array reads", () => {
  @testModel("pending-read-child")
  class Child extends Model({ key: idProp, count: tProp(0) }) {}
  @testModel("pending-read-root")
  class Root extends Model({
    child: tProp(Child, () => new Child({ key: "child" })),
    other: tProp(0),
    untouched: tProp(types.array(types.number), () => Array(5000).fill(0)),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const reads = vi.spyOn(LoroMovableList.prototype, "toArray")
  autoDispose(() => reads.mockRestore())
  root.set("other", 9)
  runUnprotected(() => {
    binding.boundObject.child.count = 2
  })
  expect(reads).not.toHaveBeenCalled()
  expect(binding.boundObject.child.count).toBe(2)
  expect(binding.boundObject.other).toBe(9)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
