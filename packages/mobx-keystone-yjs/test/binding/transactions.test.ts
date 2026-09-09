import { reaction, runInAction } from "mobx"
import {
  frozen,
  getSnapshot,
  idProp,
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

@testModel("transaction-item")
class Item extends Model({ id: idProp, value: tProp(0) }) {}

function bindRecord() {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  map.set("a", convertJsonToYjsData(getSnapshot(new Item({ id: "a", value: 1 }))))
  map.set("b", convertJsonToYjsData(getSnapshot(new Item({ id: "b", value: 2 }))))
  const binding = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(Item),
  })
  autoDispose(binding.dispose)
  return { doc, map, ...binding }
}

test("map swaps reconcile both model instances and updated values", () => {
  const { doc, map, boundObject } = bindRecord()
  const { a, b } = boundObject
  doc.transact(() => {
    map.set("a", convertJsonToYjsData({ ...getSnapshot(b), value: 20 }))
    map.set("b", convertJsonToYjsData({ ...getSnapshot(a), value: 10 }))
  })
  expect(boundObject.a).toBe(b)
  expect(boundObject.b).toBe(a)
  expect(b.value).toBe(20)
  expect(a.value).toBe(10)
})

test("moving between arrays preserves identity even when destination event comes first", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const left = new Y.Array()
  const right = new Y.Array()
  map.set("left", left)
  map.set("right", right)
  left.push([convertJsonToYjsData(getSnapshot(new Item({ id: "a" })))])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.array(Item)),
  })
  autoDispose(dispose)
  const item = boundObject.left[0]
  doc.transact(() => {
    right.push([convertJsonToYjsData({ ...getSnapshot(item), value: 10 })])
    left.delete(0, 1)
  })
  expect(boundObject.right[0]).toBe(item)
  expect(item.value).toBe(10)
  expect(boundObject.left).toHaveLength(0)
})

test("remote model initialization receives the binding context", () => {
  const contexts: unknown[] = []
  @testModel("remote-context")
  class WithContext extends Model({ value: tProp(0) }) {
    onInit() {
      contexts.push(yjsBindingContext.get(this))
    }
  }
  const doc = new Y.Doc()
  const array = doc.getArray("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(WithContext),
  })
  autoDispose(dispose)
  array.push([
    convertJsonToYjsData({
      [modelTypeKey]: getSnapshot(new WithContext({}))[modelTypeKey],
      value: 1,
    }),
  ])
  expect(contexts.at(-1)).toBe(yjsBindingContext.get(boundObject))
})

test("remote nested initialization synchronizes the final state without replaying edits twice", () => {
  @testModel("remote-nested-init-child")
  class Child extends Model({ values: tProp(types.array(types.number), () => []) }) {
    onInit() {
      this.values.push(1)
    }
  }
  @testModel("remote-nested-init-parent")
  class Parent extends Model({ child: tProp(Child, () => new Child({})) }) {
    onInit() {
      this.child.values.push(2)
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
  const type = getSnapshot(new Parent({}))[modelTypeKey]
  array.push([convertJsonToYjsData({ [modelTypeKey]: type })])
  expect(boundObject[0].child.values).toEqual([1, 2])
  expect(array.toJSON()).toEqual(getSnapshot(boundObject))
})

test("mixing local model edits and native Yjs edits in one action remains synchronized", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  array.push([1, 2])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  runUnprotected(() => {
    boundObject.push(3)
    array.insert(0, [0])
  })
  expect(array.toArray()).toEqual(boundObject.slice())
})

test("text can be edited then moved within one model action", () => {
  const doc = new Y.Doc()
  const array = doc.getArray("root")
  array.push([new Y.Text("abc")])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(YjsTextModel),
  })
  autoDispose(dispose)
  runUnprotected(() => {
    const text = boundObject[0]
    text.deltaList.push(frozen([{ retain: 3 }, { insert: "d" }]))
    boundObject.splice(0, 1)
    boundObject.push(YjsTextModel.withText("other"), text)
  })
  expect((array.get(1) as Y.Text).toString()).toBe("abcd")
})

test.each(["local-first", "native-first"])(
  "model actions nested in a native transaction (%s) apply exactly once",
  (order) => {
    const doc = new Y.Doc()
    const array = doc.getArray<number>("root")
    array.push([1, 2])
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: array,
      mobxKeystoneType: types.array(types.number),
    })
    autoDispose(dispose)
    doc.transact(() => {
      if (order === "native-first") array.insert(0, [0])
      runUnprotected(() => boundObject.push(3))
      if (order === "local-first") array.insert(0, [0])
    })
    expect(boundObject.slice()).toEqual(array.toArray())
    expect(array.toArray().filter((value) => value === 3)).toHaveLength(1)
  }
)

test("reconciliation preserves identified descendants when their wrapper is replaced", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  map.set(
    "wrapper",
    convertJsonToYjsData({ items: [getSnapshot(new Item({ id: "item", value: 1 }))] })
  )
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.record(types.array(Item))),
  })
  autoDispose(dispose)
  const item = boundObject.wrapper.items[0]
  map.set("wrapper", convertJsonToYjsData({ items: [{ ...getSnapshot(item), value: 2 }] }))
  expect(boundObject.wrapper.items[0]).toBe(item)
  expect(item.value).toBe(2)
})

test("native map edits preserve an own __proto__ key", () => {
  const doc = new Y.Doc()
  const map = doc.getMap<number>("root")
  map.set("__proto__", 1)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  expect(Object.hasOwn(getSnapshot(boundObject), "__proto__")).toBe(true)
  expect(Reflect.get(boundObject, "__proto__")).toBe(1)
  map.set("__proto__", 2)
  expect(Reflect.get(boundObject, "__proto__")).toBe(2)
})

test("queued edits made inside a native transaction survive an enclosing model action", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  array.push([1, 2])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  runUnprotected(() => {
    boundObject.push(3)
    doc.transact(() => {
      boundObject.push(4)
      array.insert(0, [0])
    })
  })
  expect(boundObject.slice()).toEqual([0, 1, 2, 3, 4])
  expect(array.toArray()).toEqual(boundObject.slice())
})

test("batched remote array edits match Yjs over repeated transactions", () => {
  const doc = new Y.Doc()
  const array = doc.getArray<number>("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  let seed = 12345
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % max
  }
  for (let transaction = 0; transaction < 100; transaction++) {
    doc.transact(() => {
      for (let operation = 0; operation < 5; operation++) {
        if (array.length > 0 && random(2)) {
          const index = random(array.length)
          array.delete(index, 1 + random(array.length - index))
        } else {
          array.insert(random(array.length + 1), [random(100), random(100)])
        }
      }
    })
    expect(boundObject.slice()).toEqual(array.toArray())
  }
})

test("Yjs undo and redo keep local text edits and model moves synchronized", () => {
  @testModel("undo-text-item")
  class TextItem extends Model({ id: idProp, text: tProp(YjsTextModel) }) {}
  const doc = new Y.Doc()
  const array = doc.getArray("root")
  const initial = [
    { id: "a", text: "abc" },
    { id: "b", text: "def" },
  ].map(({ id, text }) => getSnapshot(new TextItem({ id, text: YjsTextModel.withText(text) })))
  array.push(
    initial.map((snapshot) =>
      convertJsonToYjsData(snapshot as unknown as Parameters<typeof convertJsonToYjsData>[0])
    )
  )
  const { boundObject, dispose, yjsOrigin } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(TextItem),
  })
  autoDispose(dispose)
  const undo = new Y.UndoManager(array, { trackedOrigins: new Set([yjsOrigin]) })
  autoDispose(() => undo.destroy())
  const [first, second] = boundObject
  runUnprotected(() => {
    first.text.deltaList.push(frozen([{ retain: 3 }, { insert: "!" }]))
    boundObject.splice(0, 1)
    boundObject.push(first)
  })
  const expectState = (ids: string[], texts: string[]) => {
    expect(boundObject.map((item) => item.id)).toEqual(ids)
    expect(
      array.toArray().map((item) => ((item as Y.Map<unknown>).get("text") as Y.Text).toString())
    ).toEqual(texts)
    expect(boundObject.map((item) => item.text.text)).toEqual(texts)
    expect(boundObject.find((item) => item.id === "a")).toBe(first)
    expect(boundObject.find((item) => item.id === "b")).toBe(second)
  }
  expectState(["b", "a"], ["def", "abc!"])
  undo.undo()
  expectState(["a", "b"], ["abc", "def"])
  undo.redo()
  expectState(["b", "a"], ["def", "abc!"])
})

test.each(["native", "encoded remote"])(
  "text reactions can append local edits after %s changes",
  (source) => {
    const doc = new Y.Doc()
    const text = doc.getText("root")
    text.insert(0, "a")
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: text,
      mobxKeystoneType: YjsTextModel,
    })
    autoDispose(dispose)
    autoDispose(
      reaction(
        () => boundObject.text,
        (value) => {
          if (value === "ab")
            runUnprotected(() => {
              boundObject.deltaList.push(frozen([{ retain: 2 }, { insert: "!" }]))
            })
        }
      )
    )
    if (source === "native") {
      text.insert(1, "b")
    } else {
      const remote = new Y.Doc()
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
      remote.getText("root").insert(1, "b")
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)))
      remote.destroy()
    }
    expect(text.toString()).toBe("ab!")
    expect(boundObject.text).toBe("ab!")
    dispose()
    expect(boundObject.text).toBe("ab!")
  }
)

test("text reactions observe multi-text transactions atomically", () => {
  const doc = new Y.Doc()
  const root = doc.getMap<Y.Text>("root")
  const first = new Y.Text("a")
  const second = new Y.Text("b")
  root.set("first", first)
  root.set("second", second)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: types.record(YjsTextModel),
  })
  autoDispose(dispose)
  const states: string[] = []
  autoDispose(
    reaction(
      () => boundObject.first.text + boundObject.second.text,
      (value) => states.push(value),
      { fireImmediately: true }
    )
  )
  doc.transact(() => {
    first.insert(1, "1")
    second.insert(1, "2")
  })
  expect(states).toEqual(["ab", "a1b2"])
})

test("an outer MobX action batches reactions to text and scalar changes", () => {
  @testModel("text-and-scalar")
  class Root extends Model({
    label: tProp("old"),
    text: tProp(YjsTextModel, () => YjsTextModel.withText("a")),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const states: string[] = []
  autoDispose(
    reaction(
      () => boundObject.label + ":" + boundObject.text.text,
      (value) => states.push(value),
      { fireImmediately: true }
    )
  )
  runInAction(() => {
    doc.transact(() => {
      root.set("label", "new")
      ;(root.get("text") as Y.Text).insert(1, "b")
    })
  })
  expect(states).toEqual(["old:a", "new:ab"])
})

test.each(["native", "encoded remote"])(
  "%s text reaction edits preserve histories in multiple bindings",
  (source) => {
    const doc = new Y.Doc()
    const text = doc.getText("root")
    text.insert(0, "a")
    const bind = () => {
      const binding = bindYjsToMobxKeystone({
        yjsDoc: doc,
        yjsObject: text,
        mobxKeystoneType: YjsTextModel,
      })
      autoDispose(binding.dispose)
      return binding
    }
    const first = bind()
    const second = bind()
    autoDispose(
      reaction(
        () => first.boundObject.text,
        (value) => {
          if (value === "ab")
            runUnprotected(() => {
              first.boundObject.deltaList.push(frozen([{ retain: 2 }, { insert: "!" }]))
            })
        }
      )
    )
    if (source === "native") {
      text.insert(1, "b")
    } else {
      const remote = new Y.Doc()
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
      remote.getText("root").insert(1, "b")
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)))
      remote.destroy()
    }
    expect(text.toString()).toBe("ab!")
    first.dispose()
    second.dispose()
    expect(first.boundObject.text).toBe("ab!")
    expect(second.boundObject.text).toBe("ab!")
  }
)
