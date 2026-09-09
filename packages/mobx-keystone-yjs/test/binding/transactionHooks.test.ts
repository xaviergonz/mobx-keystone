import * as mobxKeystone from "mobx-keystone"
import { getSnapshot, runUnprotected, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone } from "../../src"
import { autoDispose } from "../utils"

test.each(["startup", "outgoing"])(
  "native edits from beforeTransaction are synchronized during %s",
  (phase) => {
    const doc = new Y.Doc()
    const root = doc.getMap<number>("root")
    root.set("local", 0)
    let armed = phase === "startup"
    const before = () => {
      if (!armed) return
      armed = false
      root.set("hook", 2)
    }
    doc.on("beforeTransaction", before)
    autoDispose(() => doc.off("beforeTransaction", before))
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: types.record(types.number),
    })
    autoDispose(dispose)
    if (phase === "outgoing") {
      armed = true
      runUnprotected(() => {
        boundObject.local = 1
      })
    }
    expect(root.get("hook")).toBe(2)
    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
  }
)

test.each([false, true])(
  "ordinary writes do not reconcile for unrelated hook changes (%s)",
  (withHook) => {
    const doc = new Y.Doc()
    const root = doc.getMap<number>("root")
    const other = doc.getMap<number>("other")
    root.set("local", 0)
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: types.record(types.number),
    })
    autoDispose(dispose)
    const before = () => {
      other.set("unrelated", 2)
    }
    if (withHook) doc.on("beforeTransaction", before)
    autoDispose(() => doc.off("beforeTransaction", before))
    const apply = vi.spyOn(mobxKeystone, "applySnapshot")
    autoDispose(() => apply.mockRestore())
    runUnprotected(() => {
      boundObject.local = 1
    })
    expect(root.toJSON()).toEqual({ local: 1 })
    expect(apply).not.toHaveBeenCalled()
  }
)

test("native hook edits to descendants are synchronized", () => {
  const doc = new Y.Doc()
  const root = doc.getMap<Y.Map<number>>("root")
  const child = new Y.Map<number>()
  child.set("local", 0)
  root.set("child", child)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(types.record(types.number)),
  })
  autoDispose(dispose)
  const before = () => {
    child.set("hook", 2)
  }
  doc.on("beforeTransaction", before)
  autoDispose(() => doc.off("beforeTransaction", before))
  runUnprotected(() => {
    boundObject.child.local = 1
  })
  expect(getSnapshot(boundObject)).toEqual({ child: { local: 1, hook: 2 } })
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})
