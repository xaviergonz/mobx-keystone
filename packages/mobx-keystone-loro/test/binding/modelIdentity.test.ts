import { LoroDoc, LoroMap } from "loro-crdt"
import { getSnapshot, idProp, Model, prop, tProp, types } from "mobx-keystone"
import {
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  bindLoroToMobxKeystone,
} from "../../src"
import { autoDispose, testModel } from "../utils"

test("merging a different model type into a nested container updates the bound instance", () => {
  @testModel("merge-type-a")
  class A extends Model({ id: idProp, value: prop(0) }) {}
  @testModel("merge-type-b")
  class B extends Model({ id: idProp, value: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, { child: getSnapshot(new A({ id: "a" })) })
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.or(A, B)),
  })
  autoDispose(dispose)
  applyJsonObjectToLoroMap(
    root,
    { child: getSnapshot(new B({ id: "b", value: 2 })) },
    { mode: "merge" }
  )
  doc.commit()
  expect(boundObject.child).toBeInstanceOf(B)
  expect(getSnapshot(boundObject)).toEqual(root.toJSON())
})

test("changing model metadata directly in Loro updates the bound model type", () => {
  @testModel("direct-type-a")
  class A extends Model({ id: idProp, value: prop(0) }) {}
  @testModel("direct-type-b")
  class B extends Model({ id: idProp, value: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, { child: getSnapshot(new A({ id: "same" })) })
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.or(A, B)),
  })
  autoDispose(dispose)
  applyJsonObjectToLoroMap(
    root.get("child") as LoroMap,
    getSnapshot(new B({ id: "same", value: 2 })),
    { mode: "merge" }
  )
  doc.commit()
  expect(boundObject.child).toBeInstanceOf(B)
  expect(getSnapshot(boundObject)).toEqual(root.toJSON())
})

test("changing a model type in a list applies its nested contents only once", () => {
  @testModel("list-type-a")
  class A extends Model({ values: prop<number[]>(() => []) }) {}
  @testModel("list-type-b")
  class B extends Model({ values: prop<number[]>(() => []) }) {}
  const doc = new LoroDoc()
  const list = doc.getMovableList("list")
  const child = list.pushContainer(new LoroMap())
  applyJsonObjectToLoroMap(child, getSnapshot(new A({ values: [1] })))
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.or(A, B)),
  })
  autoDispose(dispose)
  const remote = doc.fork()
  applyJsonObjectToLoroMap(
    remote.getMovableList("list").get(0) as LoroMap,
    getSnapshot(new B({ values: [2, 3] })),
    { mode: "merge" }
  )
  remote.commit()
  doc.import(remote.export({ mode: "update" }))
  expect(boundObject[0]).toBeInstanceOf(B)
  expect(boundObject[0].values).toEqual([2, 3])
  expect(getSnapshot(boundObject)).toEqual(list.toJSON())
})

test("removing model metadata converts a nested model to a plain object", () => {
  @testModel("model-to-object")
  class Item extends Model({ value: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, { child: getSnapshot(new Item({ value: 1 })) })
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.or(Item, types.record(types.number))),
  })
  autoDispose(dispose)
  applyJsonObjectToLoroMap(root.get("child") as LoroMap, { value: 2 }, { mode: "merge" })
  doc.commit()
  expect(boundObject.child).not.toBeInstanceOf(Item)
  expect(getSnapshot(boundObject)).toEqual({ child: { value: 2 } })
})

test("a bound root model cannot change class in place", async () => {
  const { applyLoroEventToMobx } = await import("../../src/binding/applyLoroEventToMobx")
  @testModel("root-type-a")
  class A extends Model({ value: prop(0) }) {}
  @testModel("root-type-b")
  class B extends Model({ value: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const boundObject = new A({ value: 1 })
  const before = getSnapshot(boundObject)
  let event: import("loro-crdt").LoroEvent | undefined
  autoDispose(
    doc.subscribe((batch) => {
      event = batch.events[0]
    })
  )
  applyJsonObjectToLoroMap(root, getSnapshot(new B({ value: 2 })))
  doc.commit()
  expect(() => applyLoroEventToMobx(event!, doc, boundObject, ["root"], new Set())).toThrow(
    "cannot change the model type of the bound root"
  )
  expect(getSnapshot(boundObject)).toBe(before)
})

test("native identity changes replace the nested model", () => {
  @testModel("identified")
  class Item extends Model({ id: idProp, value: tProp(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, { child: getSnapshot(new Item({ id: "a" })) })
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Item),
  })
  autoDispose(binding.dispose)
  const original = binding.boundObject.child
  ;(root.get("child") as LoroMap).set("id", "b")
  doc.commit()
  expect(binding.boundObject.child).not.toBe(original)
  expect(original.id).toBe("a")
})

test("custom model ID swaps preserve both instances and final contents", () => {
  @testModel("custom-id")
  class Item extends Model({ key: idProp, value: tProp(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, {
    first: getSnapshot(new Item({ key: "a", value: 1 })),
    second: getSnapshot(new Item({ key: "b", value: 2 })),
  })
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Item),
  })
  autoDispose(binding.dispose)
  const { first, second } = binding.boundObject
  ;(root.get("first") as LoroMap).set("key", "b")
  ;(root.get("second") as LoroMap).set("key", "a")
  doc.commit()
  expect(binding.boundObject.first).toBe(second)
  expect(binding.boundObject.second).toBe(first)
  expect(first.value).toBe(2)
  expect(second.value).toBe(1)
  expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
})

test("replacing a wrapper preserves its identified descendant", () => {
  @testModel("wrapped-id")
  class Item extends Model({ id: idProp, value: tProp(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, {
    wrapper: { child: getSnapshot(new Item({ id: "a", value: 1 })) },
  })
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.unchecked<{ wrapper: { child: Item } }>(),
  })
  autoDispose(binding.dispose)
  const original = binding.boundObject.wrapper.child
  applyJsonObjectToLoroMap(root, { wrapper: { child: { ...getSnapshot(original), value: 2 } } })
  doc.commit()
  expect(binding.boundObject.wrapper.child).toBe(original)
  expect(original.value).toBe(2)
})

test.each(["a", "z"])("moving a model to collection %s preserves its identity", (destination) => {
  @testModel("cross-collection")
  class Item extends Model({ id: idProp, value: tProp(0) }) {}
  const source = destination === "a" ? "z" : "a"
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  applyJsonObjectToLoroMap(root, {
    [source]: [getSnapshot(new Item({ id: "a" }))],
    [destination]: [],
  })
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.array(Item)),
  })
  autoDispose(binding.dispose)
  const original = binding.boundObject[source][0]
  applyJsonObjectToLoroMap(
    root,
    { [source]: [], [destination]: [{ ...getSnapshot(original), value: 2 }] },
    { mode: "merge" }
  )
  doc.commit()
  expect(binding.boundObject[destination][0]).toBe(original)
  expect(original.value).toBe(2)
  expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
})

test("moving different model types does not preview processors on stale list indices", () => {
  @testModel("plain-moved-item")
  class First extends Model({ id: idProp, title: tProp("first"), value: tProp(0) }) {}
  @testModel("processed-moved-item")
  class Second extends Model(
    { id: idProp, name: tProp("SECOND"), value: tProp(0) },
    {
      fromSnapshotProcessor: (snapshot: { id: string; name: string; value: number }) => ({
        ...snapshot,
        name: snapshot.name.toUpperCase(),
      }),
    }
  ) {}
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  applyJsonArrayToLoroMovableList(list, [
    getSnapshot(new First({ id: "first" })),
    getSnapshot(new Second({ id: "second" })),
  ])
  doc.commit()
  const errors: unknown[] = []
  const subscribe = doc.subscribe.bind(doc)
  const spy = vi.spyOn(doc, "subscribe").mockImplementation((callback) =>
    subscribe((batch) => {
      try {
        callback(batch)
      } catch (error) {
        errors.push(error)
      }
    })
  )
  autoDispose(() => spy.mockRestore())
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.or(First, Second)),
  })
  autoDispose(binding.dispose)
  const [first, second] = binding.boundObject
  list.move(1, 0)
  ;(list.get(0) as LoroMap).set("value", 2)
  doc.commit()
  expect(errors).toEqual([])
  expect(binding.boundObject[0]).toBe(second)
  expect(binding.boundObject[1]).toBe(first)
  expect(second.value).toBe(2)
  expect(getSnapshot(binding.boundObject)).toEqual(list.toJSON())
})

test("a shifted model uses its own custom ID property for identity changes", () => {
  @testModel("shifted-first-id")
  class First extends Model({ id: idProp, value: prop(0) }) {}
  @testModel("shifted-second-key")
  class Second extends Model({ key: idProp, value: prop(0) }) {}
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  applyJsonArrayToLoroMovableList(list, [
    getSnapshot(new First({ id: "a" })),
    getSnapshot(new Second({ key: "b" })),
  ])
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.or(types.number, First, Second)),
  })
  autoDispose(binding.dispose)
  const original = binding.boundObject[1] as Second
  const child = list.get(1) as LoroMap
  list.insert(0, 0)
  child.set("key", "replacement")
  doc.commit()
  expect(binding.boundObject[2]).not.toBe(original)
  expect(original.key).toBe("b")
  expect((binding.boundObject[2] as Second).key).toBe("replacement")
  expect(getSnapshot(binding.boundObject)).toEqual(list.toJSON())
})
