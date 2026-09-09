import { configure, set } from "mobx"
import { getSnapshot, Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { applyJsonObjectToYMap, bindYjsToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(["valueOf", "toString"])("binding permits the JSON key %s", (key) => {
  const doc = new Y.Doc()
  const root = doc.getMap<number>("root")
  root.set(key, 1)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  expect(getSnapshot(boundObject)).toEqual({ [key]: 1 })
  runUnprotected(() => {
    boundObject[key] = 2
  })
  expect(root.get(key)).toBe(2)
  root.set(key, 3)
  expect(boundObject[key]).toBe(3)
})

test.each([false, true])(
  "snapshot reconciliation permits method-name keys (pending edits: %s)",
  (pending) => {
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    applyJsonObjectToYMap(root, { kept: { value: 1 }, replaced: { value: 2 } })
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: types.record(types.or(types.number, types.record(types.number))),
    })
    autoDispose(dispose)
    runUnprotected(() => {
      if (pending) boundObject.local = 4
      doc.transact(() => {
        root.set("valueOf", 5)
        root.set("toString", 6)
        root.delete("replaced")
      })
    })
    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
    expect(boundObject.valueOf).toBe(5)
    expect(boundObject.toString).toBe(6)
  }
)

test("binding writes back initialization changes to the sign of zero", () => {
  @testModel("signed-zero-init")
  class Root extends Model({ value: tProp(0) }) {
    onInit() {
      this.value = -0
    }
  }
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  applyJsonObjectToYMap(root, { ...getSnapshot(new Root({})), value: 0 })
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  expect(boundObject.value).toBe(-0)
  expect(root.get("value")).toBe(-0)
})

test.each(["always", "never"] as const)(
  "native map additions remain observable (proxies: %s)",
  (useProxies) => {
    configure({ useProxies })
    try {
      const doc = new Y.Doc()
      const root = doc.getMap<number>("root")
      const { boundObject, dispose } = bindYjsToMobxKeystone({
        yjsDoc: doc,
        yjsObject: root,
        mobxKeystoneType: types.record(types.number),
      })
      autoDispose(dispose)
      root.set("added", 1)
      expect(getSnapshot(boundObject)).toEqual({ added: 1 })
      runUnprotected(() => set(boundObject, "added", 2))
      expect(root.get("added")).toBe(2)
      root.delete("added")
      expect(getSnapshot(boundObject)).toEqual({})
    } finally {
      configure({ useProxies: "always" })
    }
  }
)

test("native map additions retain explicitly undefined keys", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.maybe(types.number)),
  })
  autoDispose(dispose)
  map.set("value", undefined)
  expect(Object.hasOwn(getSnapshot(boundObject), "value")).toBe(true)
  expect(boundObject.value).toBeUndefined()
})
