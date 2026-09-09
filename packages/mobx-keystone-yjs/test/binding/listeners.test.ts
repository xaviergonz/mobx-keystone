import {
  getSnapshot,
  Model,
  onDeepChange,
  onGlobalDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone } from "../../src"
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
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
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
    const doc = new Y.Doc()
    const nativeRoot = doc.getMap("root")
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: nativeRoot,
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

test.each(["subtree", "global"] as const)(
  "%s listener errors do not hide applied changes",
  (kind) => {
    @testModel("throwing-child")
    class Child extends Model({ value: tProp(0) }) {}
    @testModel("throwing-root")
    class Root extends Model({ child: tProp(Child, () => new Child({})) }) {}
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
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
