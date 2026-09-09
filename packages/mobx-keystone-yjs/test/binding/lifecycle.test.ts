import { reaction } from "mobx"
import {
  frozen,
  getSnapshot,
  Model,
  modelTypeKey,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import {
  bindYjsToMobxKeystone,
  convertJsonToYjsData,
  YjsTextModel,
  yjsBindingContext,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test("binding inside a native transaction does not replay data already loaded", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  let boundObject: number[] = []
  doc.transact(() => {
    array.push([1, 2])
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: array,
      mobxKeystoneType: types.array(types.number),
    })
    boundObject = binding.boundObject
    autoDispose(binding.dispose)
    array.push([3])
  })
  expect(boundObject.slice()).toEqual([1, 2, 3])
  expect(array.toArray()).toEqual(boundObject.slice())
})

test("binding text inside a native transaction does not duplicate initial deltas", () => {
  const doc = new Y.Doc()
  const text = doc.getText("root")
  let boundObject: YjsTextModel | undefined
  doc.transact(() => {
    text.insert(0, "abc")
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: text,
      mobxKeystoneType: YjsTextModel,
    })
    boundObject = binding.boundObject
    autoDispose(binding.dispose)
    text.insert(3, "d")
  })
  const snapshot = getSnapshot(boundObject!)
  const copy = new Y.Doc()
  const copyText = copy.getText()
  for (const delta of snapshot.deltaList) copyText.applyDelta(delta.data)
  expect(copyText.toString()).toBe("abcd")
})

test("two bindings to the same array stay synchronized when both have pending edits", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  const bind = () => {
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: array,
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
  expect(first.slice()).toEqual(array.toArray())
  expect(second.slice()).toEqual(array.toArray())
  expect([...array.toArray()].sort()).toEqual([1, 2])
})

test("remote initialization changes to an existing sibling are synchronized", () => {
  @testModel("sibling-init-child")
  class Child extends Model({ value: tProp(0) }) {}
  @testModel("sibling-init-parent")
  class Parent extends Model({
    child: tProp(Child, () => new Child({})),
    values: tProp(types.array(types.number), () => []),
  }) {
    onInit() {
      this.values.push(1)
    }
  }
  const doc = new Y.Doc()
  const array = doc.getArray("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(Parent),
  })
  autoDispose(dispose)
  const snapshot = getSnapshot(new Parent({}))
  array.push([convertJsonToYjsData({ [modelTypeKey]: snapshot[modelTypeKey], values: [] })])
  expect(array.toJSON()).toEqual(getSnapshot(boundObject))
})

test("creating a second binding flushes and observes pending writes from the first", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  const first = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(first.dispose)
  let second: number[] = []
  runUnprotected(() => {
    first.boundObject.push(1)
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: array,
      mobxKeystoneType: types.array(types.number),
    })
    autoDispose(binding.dispose)
    second = binding.boundObject
  })
  expect(second.slice()).toEqual([1])
  expect(first.boundObject.slice()).toEqual([1])
  expect(array.toArray()).toEqual([1])
})

test("failed initial synchronization removes subscriptions and binding context", () => {
  let created: Root | undefined
  @testModel("failed-initial-sync-root")
  class Root extends Model({ value: tProp(1) }) {
    onInit() {
      created = this
    }
  }
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const error = new Error("initial sync failed")
  const set = vi.spyOn(map, "set").mockImplementation(() => {
    throw error
  })
  const unobserve = vi.spyOn(map, "unobserveDeep")
  const off = vi.spyOn(doc, "off")
  try {
    expect(() =>
      bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: map, mobxKeystoneType: Root })
    ).toThrow(error)
    expect(unobserve).toHaveBeenCalledTimes(1)
    expect(off.mock.calls.map(([event]) => event)).toContain("beforeTransaction")
    expect(off.mock.calls.map(([event]) => event)).toContain("beforeObserverCalls")
    expect(yjsBindingContext.get(created!)).toBeUndefined()
    set.mockRestore()
    runUnprotected(() => {
      created!.value = 2
    })
    expect(map.has("value")).toBe(false)
    map.set("value", 3)
    expect(created!.value).toBe(2)
  } finally {
    set.mockRestore()
    unobserve.mockRestore()
    off.mockRestore()
  }
})

test.each(["local", "remote"])("%s subtree deletion disposes its binding immediately", (source) => {
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const child = new Y.Map<number>()
  child.set("value", 1)
  root.set("child", child)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: child,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  const unobserve = vi.spyOn(child, "unobserveDeep")
  const off = vi.spyOn(doc, "off")
  try {
    if (source === "local") {
      root.delete("child")
    } else {
      const remote = new Y.Doc()
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
      remote.getMap("root").delete("child")
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)))
    }
    expect(yjsBindingContext.get(boundObject)).toBeUndefined()
    expect(unobserve).toHaveBeenCalledTimes(1)
    expect(off.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining(["destroy", "beforeTransaction", "beforeObserverCalls"])
    )
    expect(boundObject.value).toBe(1)
    runUnprotected(() => {
      boundObject.value = 2
    })
    expect(boundObject.value).toBe(2)
    dispose()
    expect(unobserve).toHaveBeenCalledTimes(1)
  } finally {
    unobserve.mockRestore()
    off.mockRestore()
  }
})

test("disposal reactions cannot write back through the binding", () => {
  const doc = new Y.Doc()
  const map = doc.getMap<number>("root")
  map.set("value", 1)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  autoDispose(
    reaction(
      () => yjsBindingContext.get(boundObject),
      (context) => {
        if (!context)
          runUnprotected(() => {
            boundObject.value = 2
          })
      }
    )
  )
  dispose()
  expect(boundObject.value).toBe(2)
  expect(map.get("value")).toBe(1)
})

test("disposal during a Yjs observer stops an already queued binding callback", () => {
  const doc = new Y.Doc()
  const map = doc.getMap<number>("root")
  map.set("value", 1)
  let stopBinding: (() => void) | undefined
  map.observeDeep(() => stopBinding?.())
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  stopBinding = dispose
  map.set("value", 2)
  expect(yjsBindingContext.get(boundObject)).toBeUndefined()
  expect(boundObject.value).toBe(1)
})

test.each([false, true])(
  "initial binding synchronizes complete properties (onInit edit: %s)",
  (edit) => {
    @testModel("required-init-root")
    class Root extends Model({ value: tProp(types.number) }) {
      onInit() {
        if (edit) this.value++
      }
    }
    const doc = new Y.Doc()
    const map = doc.getMap<number>("root")
    map.set("value", 1)
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: map,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    expect(boundObject.value).toBe(edit ? 2 : 1)
    expect(map.toJSON()).toEqual(getSnapshot(boundObject))
  }
)

test("initial binding restores missing nested model metadata", () => {
  @testModel("required-nested-child")
  class Child extends Model({ value: tProp(types.number) }) {}
  @testModel("required-nested-root")
  class Root extends Model({ child: tProp(Child) }) {}
  const snapshot = getSnapshot(new Root({ child: new Child({ value: 1 }) }))
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  map.set(modelTypeKey, snapshot[modelTypeKey])
  map.set("child", convertJsonToYjsData({ value: 1 }))
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  expect(boundObject.child).toBeInstanceOf(Child)
  expect(map.toJSON()).toEqual(getSnapshot(boundObject))
})

test("disposing during a text event removes its pending notification", () => {
  const doc = new Y.Doc()
  const text = doc.getText("root")
  text.insert(0, "a")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: text,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(dispose)
  text.observe(dispose)
  const on = vi.spyOn(doc, "on")
  const off = vi.spyOn(doc, "off")
  try {
    text.insert(1, "b")
    const notification = on.mock.calls.find(([event]) => event === "afterAllTransactions")
    expect(notification).toBeDefined()
    expect(off).toHaveBeenCalledWith("afterAllTransactions", notification![1])
    expect(yjsBindingContext.get(boundObject)).toBeUndefined()
    expect(boundObject.text).toBe("a")
  } finally {
    on.mockRestore()
    off.mockRestore()
    text.unobserve(dispose)
  }
})

test("disposing one text binding preserves other pending text notifications", () => {
  const doc = new Y.Doc()
  const first = doc.getText("first")
  const second = doc.getText("second")
  first.insert(0, "a")
  second.insert(0, "b")
  const bind = (text: Y.Text) => {
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: text,
      mobxKeystoneType: YjsTextModel,
    })
    autoDispose(binding.dispose)
    return binding
  }
  const firstBinding = bind(first)
  const secondBinding = bind(second)
  first.observe(firstBinding.dispose)
  autoDispose(() => first.unobserve(firstBinding.dispose))
  const states: string[] = []
  autoDispose(
    reaction(
      () => secondBinding.boundObject.text,
      (value) => states.push(value)
    )
  )
  const on = vi.spyOn(doc, "on")
  try {
    doc.transact(() => {
      second.insert(1, "2")
      first.insert(1, "1")
    })
    expect(states).toEqual(["b2"])
    expect(firstBinding.boundObject.text).toBe("a")
    expect(on.mock.calls.filter(([event]) => event === "afterAllTransactions")).toHaveLength(1)
  } finally {
    on.mockRestore()
  }
})

test.each(["dispose", "destroy"])(
  "%s during transaction startup cancels captured outgoing edits",
  (stop) => {
    const doc = new Y.Doc()
    const map = doc.getMap<number>("root")
    map.set("value", 1)
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: map,
      mobxKeystoneType: types.record(types.number),
    })
    autoDispose(dispose)
    const beforeTransaction = () => {
      if (stop === "dispose") dispose()
      else doc.destroy()
    }
    doc.on("beforeTransaction", beforeTransaction)
    autoDispose(() => doc.off("beforeTransaction", beforeTransaction))
    runUnprotected(() => {
      boundObject.value = 2
    })
    expect(yjsBindingContext.get(boundObject)).toBeUndefined()
    expect(boundObject.value).toBe(2)
    expect(map.get("value")).toBe(1)
  }
)

test("disposal during default writeback prevents the captured snapshot from being merged", () => {
  @testModel("cancel-default-writeback")
  class Root extends Model({ value: tProp(5) }) {}
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose, yjsOrigin } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const beforeTransaction = (transaction: Y.Transaction) => {
    if (transaction.origin === yjsOrigin) dispose()
  }
  doc.on("beforeTransaction", beforeTransaction)
  autoDispose(() => doc.off("beforeTransaction", beforeTransaction))
  map.delete("value")
  expect(yjsBindingContext.get(boundObject)).toBeUndefined()
  expect(boundObject.value).toBe(5)
  expect(map.has("value")).toBe(false)
})

test("a binding created during a net-zero transaction reconciles its intermediate snapshot", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  let boundObject: number[] = []
  doc.transact(() => {
    array.push([1])
    const binding = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: array,
      mobxKeystoneType: types.array(types.number),
    })
    autoDispose(binding.dispose)
    boundObject = binding.boundObject
    array.delete(0, 1)
  })
  expect(boundObject.slice()).toEqual([])
  expect(array.toArray()).toEqual([])
})

test("local edits in a net-zero native transaction reconcile to the final array", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  doc.transact(() => {
    runUnprotected(() => boundObject.push(1))
    array.delete(0, 1)
  })
  expect(boundObject.slice()).toEqual([])
  expect(array.toArray()).toEqual([])
})

test.each(["initialization", "local edit"])(
  "a net-zero map transaction reconciles intermediate state from %s",
  (source) => {
    const doc = new Y.Doc()
    const map = doc.getMap<number>("root")
    const bind = () => {
      const binding = bindYjsToMobxKeystone({
        yjsDoc: doc,
        yjsObject: map,
        mobxKeystoneType: types.record(types.number),
      })
      autoDispose(binding.dispose)
      return binding.boundObject
    }
    let boundObject: Record<string, number> = {}
    if (source === "local edit") boundObject = bind()
    doc.transact(() => {
      if (source === "initialization") {
        map.set("temporary", 1)
        boundObject = bind()
      } else {
        runUnprotected(() => {
          boundObject.temporary = 1
        })
      }
      map.delete("temporary")
    })
    expect(getSnapshot(boundObject)).toEqual({})
    expect(map.toJSON()).toEqual({})
  }
)

test.each(["initialization", "local edit"])(
  "a net-zero text transaction reconciles intermediate history from %s",
  (source) => {
    const doc = new Y.Doc()
    const text = doc.getText("root")
    const bindings: ReturnType<typeof bindText>[] = []
    function bindText() {
      const binding = bindYjsToMobxKeystone({
        yjsDoc: doc,
        yjsObject: text,
        mobxKeystoneType: YjsTextModel,
      })
      autoDispose(binding.dispose)
      return binding
    }
    if (source === "local edit") bindings.push(bindText())
    doc.transact(() => {
      if (source === "initialization") {
        text.insert(0, "temporary")
        bindings.push(bindText())
      } else {
        runUnprotected(() => {
          bindings[0].boundObject.deltaList.push(frozen([{ insert: "temporary" }]))
        })
      }
      text.delete(0, 9)
    })
    expect(text.toString()).toBe("")
    const binding = bindings[0]
    expect(binding.boundObject.text).toBe("")
    binding.dispose()
    // Detached reads replay the history, so a stale intermediate edit cannot
    // hide behind the live native text.
    expect(binding.boundObject.text).toBe("")
  }
)
