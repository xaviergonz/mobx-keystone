import { LoroDoc, LoroMap } from "loro-crdt"
import { getSnapshot, Model, prop, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, loroBindingContext, MobxKeystoneLoroError } from "../../src"
import { autoDispose, testModel } from "../utils"

test("binding rejects a detached container", () => {
  const map = new LoroMap()
  map.set("value", 1)
  expect(() =>
    bindLoroToMobxKeystone({
      loroDoc: new LoroDoc(),
      loroObject: map,
      mobxKeystoneType: types.record(types.number),
    })
  ).toThrow(MobxKeystoneLoroError)
})

test("failed initialization leaves no document subscriptions", () => {
  @testModel("unsupported-default")
  class Root extends Model({ value: prop(1) }) {}
  const doc = new LoroDoc()
  const map = doc.getMap("root")
  const set = vi.spyOn(map, "set").mockImplementation(() => {
    throw new Error("initial sync failed")
  })
  const unsubscribe = vi.fn()
  const originalSubscribe = doc.subscribe.bind(doc)
  const subscribe = vi.spyOn(doc, "subscribe").mockImplementation((callback) => {
    const originalUnsubscribe = originalSubscribe(callback)
    return () => {
      unsubscribe()
      originalUnsubscribe()
    }
  })
  try {
    expect(() =>
      bindLoroToMobxKeystone({
        loroDoc: doc,
        loroObject: map,
        mobxKeystoneType: Root,
      })
    ).toThrow()
    expect(unsubscribe).toHaveBeenCalledTimes(subscribe.mock.calls.length)
  } finally {
    subscribe.mockRestore()
    set.mockRestore()
  }
})

test("initial binding synchronizes model metadata without defaults", () => {
  @testModel("required")
  class Root extends Model({ value: tProp(types.number) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.set("value", 1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("deleted bound containers dispose their binding context", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const child = root.setContainer("child", new LoroMap())
  child.set("value", 1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: child,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(binding.dispose)
  root.delete("child")
  doc.commit()
  expect(loroBindingContext.get(binding.boundObject)).toBeUndefined()
  runUnprotected(() => {
    binding.boundObject.value = 2
  })
  expect(child.get("value")).toBe(1)
})

test("binding an uncommitted list does not replay its initial contents", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  list.push(1)
  list.push(2)
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(binding.dispose)
  list.push(3)
  doc.commit()
  expect(binding.boundObject.slice()).toEqual([1, 2, 3])
})

test("two bindings with pending edits converge on the same list", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  const bind = () => {
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: list,
      mobxKeystoneType: types.array(types.number),
    })
    autoDispose(binding.dispose)
    return binding.boundObject
  }
  const first = bind()
  const second = bind()
  runUnprotected(() => {
    first.push(1)
    second.push(2)
  })
  expect(first.slice()).toEqual(list.toArray())
  expect(second.slice()).toEqual(list.toArray())
  expect(first.slice().sort()).toEqual([1, 2])
})

test("binding during a net-zero pending list edit observes the final empty list", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  list.push(1)
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(binding.dispose)
  list.delete(0, 1)
  doc.commit()
  expect(binding.boundObject.slice()).toEqual([])
})
