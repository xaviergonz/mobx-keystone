import { LoroDoc, type LoroEvent, LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { observe } from "mobx"
import {
  getGlobalConfig,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  setGlobalConfig,
  TypeCheckErrorFailure,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone, convertJsonToLoroData, LoroTextModel } from "../../src"
import { applyLoroEventsToMobx } from "../../src/binding/applyLoroEventToMobx"
import { autoDispose, testModel } from "../utils"

beforeEach(() => {
  const previous = getGlobalConfig().modelAutoTypeChecking
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
  autoDispose(() => setGlobalConfig({ modelAutoTypeChecking: previous }))
})

test.each(["separated", "large"])(
  "native %s list replacements validate their completed state",
  (kind) => {
    const initial = kind === "large" ? Array.from({ length: 10000 }, () => 1) : [1, 2, 3]
    @testModel("list-refinement-root")
    class Root extends Model({
      values: tProp(
        types.refinement(types.array(types.number), (values) =>
          kind === "large"
            ? values.every((v) => v === values[0])
            : values.reduce((a, b) => a + b, 0) === 6
        )
      ),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const list = root.setContainer("values", new LoroMovableList())
    for (const value of initial) list.push(value)
    doc.commit()
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    binding.dispose()
    let events: LoroEvent[] = []
    autoDispose(
      doc.subscribe((batch) => {
        events = batch.events
      })
    )
    if (kind === "large") {
      list.delete(0, initial.length)
      for (let i = 0; i < initial.length; i++) list.push(2)
    } else {
      list.set(0, 3)
      list.set(2, 1)
    }
    doc.commit()
    const changed = vi.fn()
    autoDispose(observe(binding.boundObject.values, changed))
    applyLoroEventsToMobx(events, doc, binding.boundObject, ["root"], new Set())
    expect(getSnapshot(binding.boundObject.values)).toEqual(list.toArray())
    expect(changed).toHaveBeenCalledTimes(1)
  }
)

test("multi-key map changes validate completed object refinements", () => {
  @testModel("map-refinement-root")
  class Root extends Model({
    pair: tProp(
      types.refinement(
        types.object(() => ({ left: types.number, right: types.number })),
        (pair) => pair.left + pair.right === 4
      )
    ),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const pair = root.setContainer("pair", new LoroMap())
  pair.set("left", 1)
  pair.set("right", 3)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  binding.dispose()
  let events: LoroEvent[] = []
  autoDispose(
    doc.subscribe((batch) => {
      events = batch.events
    })
  )
  pair.set("left", 3)
  pair.set("right", 1)
  doc.commit()
  applyLoroEventsToMobx(events, doc, binding.boundObject, ["root"], new Set())
  expect(getSnapshot(binding.boundObject.pair)).toEqual(pair.toJSON())
})

test("transactions validate refinements spanning sibling maps", () => {
  @testModel("sibling-map-refinement-root")
  class Root extends Model({
    pair: tProp(
      types.refinement(
        types.object(() => ({
          left: types.record(types.number),
          right: types.record(types.number),
        })),
        (pair) => pair.left.value + pair.right.value === 4
      )
    ),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const pair = root.setContainer("pair", new LoroMap())
  const left = pair.setContainer("left", new LoroMap())
  const right = pair.setContainer("right", new LoroMap())
  left.set("value", 1)
  right.set("value", 3)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  binding.dispose()
  let events: LoroEvent[] = []
  autoDispose(
    doc.subscribe((batch) => {
      events = batch.events
    })
  )
  left.set("value", 3)
  right.set("value", 1)
  doc.commit()
  const result = applyLoroEventsToMobx(events, doc, binding.boundObject, ["root"], new Set())
  expect(result?.target).toBe(binding.boundObject.pair)
  expect(getSnapshot(binding.boundObject.pair)).toEqual(pair.toJSON())
})

test.each([false, true])(
  "separated list edits use a bounded changed range (checking: %s)",
  (enabled) => {
    setGlobalConfig({
      modelAutoTypeChecking: enabled
        ? ModelAutoTypeCheckingMode.AlwaysOn
        : ModelAutoTypeCheckingMode.AlwaysOff,
    })
    @testModel("changed-range-root")
    class Root extends Model({ values: tProp(types.array(types.number)) }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const list = root.setContainer("values", new LoroMovableList())
    for (let i = 0; i < 10000; i++) list.push(i)
    doc.commit()
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    binding.dispose()
    let events: LoroEvent[] = []
    autoDispose(
      doc.subscribe((batch) => {
        events = batch.events
      })
    )
    list.set(5000, -1)
    list.set(5002, -2)
    doc.commit()
    const changed = vi.fn()
    autoDispose(observe(binding.boundObject.values, changed))
    expect(
      applyLoroEventsToMobx(events, doc, binding.boundObject, ["root"], new Set())
    ).toBeUndefined()
    expect(changed).toHaveBeenCalledTimes(enabled ? 1 : 2)
    for (const [change] of changed.mock.calls) expect(change.added).toHaveLength(enabled ? 3 : 1)
    expect(getSnapshot(binding.boundObject.values)).toEqual(list.toArray())
  }
)

test.each(["array", "map", "text"])(
  "commits validate refinements spanning a scalar and %s",
  (kind) => {
    const valueType =
      kind === "array"
        ? types.array(types.number)
        : kind === "map"
          ? types.record(types.number)
          : LoroTextModel
    @testModel("scalar-container-root")
    class Root extends Model({
      pair: tProp(
        types.refinement(
          types.object(() => ({ count: types.number, value: valueType })),
          (pair) =>
            pair.count ===
            (pair.value instanceof LoroTextModel
              ? pair.value.deltaList.data.reduce(
                  (length, part) => length + (part.insert?.length ?? 0),
                  0
                )
              : Object.values(pair.value)[0])
        )
      ),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const pair = root.setContainer("pair", new LoroMap())
    pair.set("count", 1)
    const value =
      kind === "array"
        ? pair.setContainer("value", new LoroMovableList())
        : kind === "map"
          ? pair.setContainer("value", new LoroMap())
          : pair.setContainer("value", new LoroText())
    if (value instanceof LoroMovableList) value.push(1)
    else if (value instanceof LoroMap) value.set("n", 1)
    else value.insert(0, "a")
    doc.commit()
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    binding.dispose()
    let events: LoroEvent[] = []
    autoDispose(
      doc.subscribe((batch) => {
        events = batch.events
      })
    )
    pair.set("count", 2)
    if (value instanceof LoroMovableList) value.set(0, 2)
    else if (value instanceof LoroMap) value.set("n", 2)
    else value.insert(1, "b")
    doc.commit()
    const result = applyLoroEventsToMobx(events, doc, binding.boundObject, ["root"], new Set())
    expect(result?.target).toBe(binding.boundObject.pair)
    expect(binding.boundObject.pair.count).toBe(2)
    expect(binding.boundObject.typeCheck()).toBeNull()
    pair.set("count", 9)
    doc.commit()
    expect(() =>
      applyLoroEventsToMobx(events, doc, binding.boundObject, ["root"], new Set())
    ).toThrow(TypeCheckErrorFailure)
    expect(binding.boundObject.pair.count).toBe(2)
  }
)

test("combined list splices preserve retained model identity", () => {
  @testModel("retained-child")
  class Child extends Model({ value: tProp(7) }) {}
  @testModel("retained-root")
  class Root extends Model({ values: tProp(types.array(types.or(types.number, Child))) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const list = root.setContainer("values", new LoroMovableList())
  list.push(1)
  list.pushContainer(convertJsonToLoroData(getSnapshot(new Child({}))) as LoroMap)
  list.push(2)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  binding.dispose()
  const child = binding.boundObject.values[1]
  let events: LoroEvent[] = []
  autoDispose(
    doc.subscribe((batch) => {
      events = batch.events
    })
  )
  list.set(0, 3)
  list.set(2, 4)
  doc.commit()
  expect(
    applyLoroEventsToMobx(events, doc, binding.boundObject, ["root"], new Set())
  ).toBeUndefined()
  expect(binding.boundObject.values[1]).toBe(child)
})
