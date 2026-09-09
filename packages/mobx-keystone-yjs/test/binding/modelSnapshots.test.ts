import * as mobxKeystone from "mobx-keystone"
import {
  getSnapshot,
  idProp,
  Model,
  modelTypeKey,
  runUnprotected,
  timestampToDateTransform,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, convertJsonToYjsData } from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("snapshot-defaults")
class WithDefaults extends Model({ value: tProp(types.number, 5) }) {}

test("deleting a defaulted model property restores and synchronizes the default", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  map.set("value", 10)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: WithDefaults,
  })
  autoDispose(dispose)
  map.delete("value")
  expect(boundObject.value).toBe(5)
  expect(map.get("value")).toBe(5)
})

@testModel("snapshot-first")
class First extends Model({ first: tProp(1) }) {}
@testModel("snapshot-second")
class Second extends Model({ second: tProp(2) }) {}

test("changing a nested model discriminator replaces the model instance", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const child = convertJsonToYjsData(getSnapshot(new First({}))) as Y.Map<unknown>
  map.set("child", child)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(types.or(First, Second)),
  })
  autoDispose(dispose)
  doc.transact(() => {
    child.set(modelTypeKey, getSnapshot(new Second({}))[modelTypeKey])
    child.delete("first")
    child.set("second", 20)
  })
  expect(boundObject.child).toBeInstanceOf(Second)
  expect(getSnapshot(boundObject.child)).toEqual(child.toJSON())
})

test.each([null, undefined])(
  "a nullish model value (%s) uses snapshot default semantics",
  (value) => {
    const doc = new Y.Doc()
    const map = doc.getMap("root")
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: map,
      mobxKeystoneType: WithDefaults,
    })
    autoDispose(dispose)
    map.set("value", value)
    expect(boundObject.value).toBe(5)
    expect(map.get("value")).toBe(5)
  }
)

test("default restoration also synchronizes after queued local edits", () => {
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: WithDefaults,
  })
  autoDispose(dispose)
  runUnprotected(() => {
    boundObject.value = 7
    map.delete("value")
  })
  expect(boundObject.value).toBe(5)
  expect(map.get("value")).toBe(5)
})

test("nested model ID replacement creates a new instance and skips repeated IDs", () => {
  @testModel("default-id-item")
  class Item extends Model({ id: idProp, value: tProp(1) }) {}
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const child = convertJsonToYjsData(getSnapshot(new Item({ id: "original" }))) as Y.Map<unknown>
  map.set("child", child)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: types.record(Item),
  })
  autoDispose(dispose)
  const original = boundObject.child
  child.set("id", "replacement")
  expect(boundObject.child).not.toBe(original)
  expect(boundObject.child.id).toBe("replacement")
  expect(original.id).toBe("original")
  expect(child.toJSON()).toEqual(getSnapshot(boundObject.child))
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    child.set("id", "replacement")
    expect(apply).not.toHaveBeenCalled()
  } finally {
    apply.mockRestore()
  }
})

test("changing custom model IDs reconciles identities through their parent", () => {
  @testModel("custom-id-item")
  class Item extends Model({ key: idProp, value: tProp(0) }) {}
  const doc = new Y.Doc()
  const array = doc.getArray<Y.Map<unknown>>("root")
  array.push([
    convertJsonToYjsData(getSnapshot(new Item({ key: "a", value: 1 }))) as Y.Map<unknown>,
    convertJsonToYjsData(getSnapshot(new Item({ key: "b", value: 2 }))) as Y.Map<unknown>,
  ])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(Item),
  })
  autoDispose(dispose)
  const [first, second] = boundObject
  doc.transact(() => {
    array.get(0).set("key", "b")
    array.get(1).set("key", "a")
  })
  expect(boundObject[0]).toBe(second)
  expect(boundObject[1]).toBe(first)
  expect(first.value).toBe(2)
  expect(second.value).toBe(1)
  expect(getSnapshot(boundObject)).toEqual(array.toJSON())
})

test.each(["root", "nested"])("repeating %s model metadata avoids reconciliation", (location) => {
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const snapshot = getSnapshot(new WithDefaults({ value: 1 }))
  const map = location === "root" ? root : new Y.Map<unknown>()
  if (location === "nested") root.set("child", map)
  map.set(modelTypeKey, snapshot[modelTypeKey])
  map.set("value", snapshot.value)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: location === "root" ? WithDefaults : types.record(WithDefaults),
  })
  autoDispose(dispose)
  const boundModel = boundObject instanceof WithDefaults ? boundObject : boundObject.child
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    doc.transact(() => {
      map.set(modelTypeKey, snapshot[modelTypeKey])
      map.set("value", 2)
    })
    expect(boundModel.value).toBe(2)
    expect(map.toJSON()).toEqual(getSnapshot(boundModel))
    expect(apply).not.toHaveBeenCalled()
  } finally {
    apply.mockRestore()
  }
})

test("incoming model values use the stored representation of transformed properties", () => {
  @testModel("transformed-timestamp")
  class Root extends Model({
    date: tProp(types.number, 0).withTransform(timestampToDateTransform()),
  }) {}
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  map.set("date", 1000)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  expect(boundObject.date.getTime()).toBe(1000)
  map.set("date", 2000)
  expect(boundObject.date.getTime()).toBe(2000)
  expect(getSnapshot(boundObject)).toEqual(map.toJSON())
  runUnprotected(() => {
    boundObject.date = new Date(3000)
  })
  expect(map.get("date")).toBe(3000)
})

test.each([undefined, 10])(
  "incoming numeric values bypass property untransforms (initial: %s)",
  (initial) => {
    @testModel("transformed-number")
    class Root extends Model({
      value: tProp(types.maybe(types.number)).withTransform({
        transform: ({ originalValue }) => originalValue * 2,
        untransform: ({ transformedValue }: { transformedValue: number }) => transformedValue / 2,
      }),
    }) {}
    const doc = new Y.Doc()
    const map = doc.getMap("root")
    if (initial !== undefined) map.set("value", initial)
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: map,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    expect(boundObject.value).toBe(initial === undefined ? undefined : initial * 2)
    map.set("value", 30)
    expect(boundObject.value).toBe(60)
    expect(getSnapshot(boundObject)).toEqual(map.toJSON())
    runUnprotected(() => {
      boundObject.value = 80
    })
    expect(map.get("value")).toBe(40)
  }
)

test.each(["root", "nested"])(
  "incoming %s model updates run snapshot normalization",
  (location) => {
    @testModel("normalized-number")
    class Root extends Model(
      { value: tProp(types.number, 0) },
      {
        fromSnapshotProcessor: (snapshot: { value: number }) => ({
          ...snapshot,
          value: Math.round(snapshot.value),
        }),
      }
    ) {}
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const map = location === "root" ? root : new Y.Map<unknown>()
    if (location === "nested") root.set("child", map)
    map.set("value", 1)
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: location === "root" ? Root : types.record(Root),
    })
    autoDispose(dispose)
    const boundModel = boundObject instanceof Root ? boundObject : boundObject.child
    const apply = vi.spyOn(mobxKeystone, "applySnapshot")
    try {
      map.set("value", 2.7)
      expect(boundModel.value).toBe(3)
      expect(map.get("value")).toBe(3)
      expect(apply).toHaveBeenCalledTimes(1)
      expect(apply.mock.calls[0][0]).toBe(boundModel)
      apply.mockClear()
      map.set("value", 4)
      expect(boundModel.value).toBe(4)
      expect(apply).not.toHaveBeenCalled()
    } finally {
      apply.mockRestore()
    }
    runUnprotected(() => {
      boundModel.value = 5
    })
    expect(map.get("value")).toBe(5)
  }
)

test("snapshot normalization converts added containers only once", () => {
  @testModel("normalized-array")
  class Root extends Model(
    { values: tProp(types.maybe(types.array(types.number))) },
    {
      fromSnapshotProcessor: (snapshot: { values?: number[] }) => snapshot,
    }
  ) {}
  const doc = new Y.Doc()
  const map = doc.getMap("root")
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: map,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const array = new Y.Array<number>()
  array.push([1, 2, 3])
  const reads = vi.spyOn(array, "map")
  try {
    map.set("values", array)
    expect(getSnapshot(boundObject).values).toEqual([1, 2, 3])
    expect(reads).toHaveBeenCalledTimes(1)
  } finally {
    reads.mockRestore()
  }
})

test.each([false, true])(
  "unchanged native model values skip processing (reverted: %s)",
  (reverted) => {
    const normalize = vi.fn((snapshot: { value: number }) => snapshot)
    @testModel("repeated-processed-value")
    class Root extends Model(
      { value: tProp(types.number, 0) },
      {
        fromSnapshotProcessor: normalize,
      }
    ) {}
    const doc = new Y.Doc()
    const map = doc.getMap("root")
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: map,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    const snapshot = getSnapshot(boundObject)
    normalize.mockClear()
    doc.transact(() => {
      if (reverted) map.set("value", 1)
      map.set("value", 0)
      map.set(modelTypeKey, snapshot[modelTypeKey])
    })
    expect(getSnapshot(boundObject)).toBe(snapshot)
    expect(normalize).not.toHaveBeenCalled()
    map.set("value", 2)
    expect(boundObject.value).toBe(2)
    expect(normalize).toHaveBeenCalled()
  }
)

test("shifted models retain correct processor input and custom identity handling", () => {
  @testModel("shifted-processor-first")
  class First extends Model({ id: idProp, title: tProp("first") }) {}
  @testModel("shifted-processor-second")
  class Second extends Model(
    { key: idProp, name: tProp("SECOND"), value: tProp(0) },
    {
      fromSnapshotProcessor: (snapshot: { key: string; name: string; value: number }) => ({
        ...snapshot,
        name: snapshot.name.toUpperCase(),
      }),
    }
  ) {}
  const doc = new Y.Doc()
  const array = doc.getArray<Y.Map<unknown> | number>("root")
  array.push([
    convertJsonToYjsData(getSnapshot(new First({ id: "first" }))) as Y.Map<unknown>,
    convertJsonToYjsData(getSnapshot(new Second({ key: "second" }))) as Y.Map<unknown>,
  ])
  const binding = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: array,
    mobxKeystoneType: types.array(types.or(types.number, First, Second)),
  })
  autoDispose(binding.dispose)
  const original = binding.boundObject[1] as Second
  const child = array.get(1) as Y.Map<unknown>
  doc.transact(() => {
    array.insert(0, [0])
    child.set("value", 2)
  })
  expect(binding.boundObject[2]).toBe(original)
  expect(original.value).toBe(2)
  doc.transact(() => {
    array.insert(0, [0])
    child.set("key", "replacement")
  })
  expect(binding.boundObject[3]).not.toBe(original)
  expect(original.key).toBe("second")
  expect(getSnapshot(binding.boundObject)).toEqual(array.toJSON())
})
