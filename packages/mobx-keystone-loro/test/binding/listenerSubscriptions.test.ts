import { LoroDoc } from "loro-crdt"
import { getSnapshot, Model, onDeepChange, runUnprotected, tProp } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("self-disposing model listeners do not skip binding synchronization", () => {
  @testModel("self-disposing-root")
  class Root extends Model({ value: tProp(0) }) {
    onInit() {
      const stop = onDeepChange(this, (change) => {
        if (!change.isInit) stop()
      })
      autoDispose(stop)
    }
  }
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  runUnprotected(() => {
    binding.boundObject.value = 1
  })
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  runUnprotected(() => {
    binding.boundObject.value = 2
  })
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
