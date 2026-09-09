import { LoroDoc, LoroMap } from "loro-crdt"
import { getSnapshot, idProp, Model, prop, tProp, types } from "mobx-keystone"
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(["record", "model"])(
  "swapping model snapshots between %s keys preserves both instances",
  (kind) => {
    @testModel("item")
    class Item extends Model({ id: idProp, value: prop(0) }) {}
    @testModel("root")
    class Root extends Model({ a: tProp(Item), b: tProp(Item) }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const a = getSnapshot(new Item({ id: "a", value: 1 }))
    const b = getSnapshot(new Item({ id: "b", value: 2 }))
    const initial =
      kind === "record"
        ? { a, b }
        : {
            $modelType: getSnapshot(
              new Root({ a: new Item({ id: "a" }), b: new Item({ id: "b" }) })
            ).$modelType,
            a,
            b,
          }
    applyJsonObjectToLoroMap(root, initial)
    doc.commit()
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: kind === "record" ? types.record(Item) : Root,
    })
    autoDispose(dispose)
    const first = boundObject.a
    const second = boundObject.b
    applyJsonObjectToLoroMap(root, { a: { ...b, value: 20 }, b: { ...a, value: 10 } })
    doc.commit()
    expect(getSnapshot(boundObject)).toEqual({
      ...initial,
      a: { ...b, value: 20 },
      b: { ...a, value: 10 },
    })
    expect(boundObject.a).toBe(second)
    expect(boundObject.b).toBe(first)
  }
)

test("a three-way model rotation preserves instances without serializing retained siblings", () => {
  @testModel("rotation-item")
  class Item extends Model({ id: idProp, value: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const snapshots = ["a", "b", "c", "untouched"].map((id, value) =>
    getSnapshot(new Item({ id, value }))
  )
  applyJsonObjectToLoroMap(
    root,
    Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]))
  )
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Item),
  })
  autoDispose(dispose)
  const originals = { ...boundObject }
  const untouched = root.get("untouched") as LoroMap
  const entries = vi.spyOn(LoroMap.prototype, "entries")
  try {
    applyJsonObjectToLoroMap(root, { a: snapshots[1], b: snapshots[2], c: snapshots[0] })
    untouched.set("value", 99)
    doc.commit()
    expect(
      entries.mock.contexts.filter(
        (container) => container instanceof LoroMap && container.id === untouched.id
      )
    ).toHaveLength(0)
  } finally {
    entries.mockRestore()
  }
  expect(boundObject.a).toBe(originals.b)
  expect(boundObject.b).toBe(originals.c)
  expect(boundObject.c).toBe(originals.a)
  expect(boundObject.untouched).toBe(originals.untouched)
  expect(getSnapshot(boundObject)).toEqual(root.toJSON())
})

test("moving a model snapshot to a new map key while deleting its old key preserves identity", () => {
  @testModel("renamed-item")
  class Item extends Model({ id: idProp, value: prop(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const snapshot = getSnapshot(new Item({ id: "item", value: 1 }))
  applyJsonObjectToLoroMap(root, { old: snapshot })
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(Item),
  })
  autoDispose(dispose)
  const original = boundObject.old
  applyJsonObjectToLoroMap(root, { renamed: { ...snapshot, value: 2 } }, { mode: "merge" })
  doc.commit()
  expect(boundObject.renamed).toBe(original)
  expect(boundObject.renamed.value).toBe(2)
  expect(Object.hasOwn(boundObject, "old")).toBe(false)
  expect(getSnapshot(boundObject)).toEqual(root.toJSON())
})
