import { LoroDoc } from "loro-crdt"
import {
  getSnapshot,
  Model,
  onDeepChange,
  onGlobalDeepChange,
  runUnprotected,
  tProp,
} from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(["subtree", "global"] as const)(
  "%s listener errors do not hide applied changes",
  (kind) => {
    @testModel("throwing-child")
    class Child extends Model({ value: tProp(0) }) {}
    @testModel("throwing-root")
    class Root extends Model({ child: tProp(Child, () => new Child({})) }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(binding.dispose)
    const child = binding.boundObject.child
    const error = new Error("listener failed")
    const listener = () => {
      throw error
    }
    const stop =
      kind === "subtree"
        ? onDeepChange(child, listener)
        : onGlobalDeepChange((target) => {
            if (target === child) listener()
          })
    autoDispose(stop)
    expect(() =>
      runUnprotected(() => {
        child.value = 1
      })
    ).toThrow(error)
    expect(child.value).toBe(1)
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
    stop()
    runUnprotected(() => {
      child.value = 2
    })
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)
