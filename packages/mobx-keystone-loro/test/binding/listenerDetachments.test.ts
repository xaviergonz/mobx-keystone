import { LoroDoc } from "loro-crdt"
import { getSnapshot, Model, onDeepChange, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([false, true])(
  "listener detachments synchronize final state (reattach: %s)",
  (reattach) => {
    @testModel("detached-listener-child")
    class Child extends Model({ value: tProp(0) }) {}
    @testModel("detached-listener-root")
    class Root extends Model({
      left: tProp(types.maybe(Child)),
      right: tProp(types.maybe(Child)),
    }) {}
    const doc = new LoroDoc()
    const nativeRoot = doc.getMap("root")
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: nativeRoot,
      mobxKeystoneType: Root,
    })
    autoDispose(binding.dispose)
    const root = binding.boundObject
    runUnprotected(() => {
      root.left = new Child({})
    })
    const child = root.left!
    autoDispose(
      onDeepChange(child, () => {
        if (child.value === 1) {
          root.left = undefined
          if (reattach) root.right = child
        }
      })
    )
    runUnprotected(() => {
      child.value = 1
    })
    expect(root.left).toBeUndefined()
    expect(root.right).toBe(reattach ? child : undefined)
    expect(nativeRoot.toJSON()).toEqual(getSnapshot(root))
    runUnprotected(() => {
      child.value = 2
    })
    expect(nativeRoot.toJSON()).toEqual(getSnapshot(root))
  }
)
