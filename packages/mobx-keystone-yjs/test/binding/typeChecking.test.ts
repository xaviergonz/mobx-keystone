import * as mobxKeystone from "mobx-keystone"
import {
  getGlobalConfig,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  prop,
  setGlobalConfig,
  TypeCheckErrorFailure,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { applyJsonObjectToYMap, bindYjsToMobxKeystone, YjsTextModel } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(
  [false, true].flatMap((enableAfterBinding) =>
    ["array", "map", "multiple"].map((kind) => ({ enableAfterBinding, kind }))
  )
)(
  "native $kind updates validate through untyped models (enable after binding: $enableAfterBinding)",
  ({ enableAfterBinding, kind }) => {
    const previous = getGlobalConfig().modelAutoTypeChecking
    autoDispose(() => setGlobalConfig({ modelAutoTypeChecking: previous }))
    setGlobalConfig({
      modelAutoTypeChecking: enableAfterBinding
        ? ModelAutoTypeCheckingMode.AlwaysOff
        : ModelAutoTypeCheckingMode.AlwaysOn,
    })
    @testModel("untyped-validation-bridge")
    class Bridge extends Model({
      values: prop<number[]>(() => [1, 2, 3]),
      pair: prop(() => ({ left: 1, right: 3 })),
    }) {}
    @testModel("typed-validation-ancestor")
    class Root extends Model({
      bridge: tProp(
        types.refinement(
          types.unchecked<Bridge>(),
          (bridge) =>
            bridge.values.reduce((sum, value) => sum + value, 0) +
              bridge.pair.left +
              bridge.pair.right ===
            10
        )
      ),
    }) {}
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    applyJsonObjectToYMap(root, getSnapshot(new Root({ bridge: new Bridge({}) })))
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
    const bridge = root.get("bridge") as Y.Map<unknown>
    const values = bridge.get("values") as Y.Array<number>
    const pair = bridge.get("pair") as Y.Map<number>
    const replace = (index: number, value: number) => {
      values.delete(index, 1)
      values.insert(index, [value])
    }
    const transact = (fn: () => void) => {
      doc.transact(fn)
    }
    transact(() => {
      if (kind !== "map") {
        replace(0, 3)
        replace(2, kind === "multiple" ? 2 : 1)
      }
      if (kind !== "array") {
        pair.set("left", kind === "multiple" ? 2 : 3)
        pair.set("right", 1)
      }
    })

    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
    const valid = getSnapshot(boundObject)
    const invalid = () =>
      transact(() => {
        if (kind !== "map") replace(0, 9)
        if (kind !== "array") pair.set("left", 9)
      })
    expect(invalid).toThrow(TypeCheckErrorFailure)
    expect(getSnapshot(boundObject)).toEqual(valid)
  }
)

test.each(["arrays", "maps"])("transactions validate refinements spanning sibling %s", (kind) => {
  const previous = getGlobalConfig().modelAutoTypeChecking
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
  autoDispose(() => setGlobalConfig({ modelAutoTypeChecking: previous }))
  const containerType = kind === "arrays" ? types.array(types.number) : types.record(types.number)
  @testModel("cross-container-root")
  class Root extends Model({
    untouched: tProp(types.array(types.number), () => [10, 20]),
    pair: tProp(
      types.refinement(
        types.object(() => ({ left: containerType, right: containerType })),
        (pair) =>
          [...Object.values(pair.left), ...Object.values(pair.right)].reduce((a, b) => a + b, 0) ===
          4
      )
    ),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const pair = new Y.Map()
  const left = kind === "arrays" ? new Y.Array<number>() : new Y.Map<number>()
  const right = kind === "arrays" ? new Y.Array<number>() : new Y.Map<number>()
  const assign = (container: typeof left, value: number) => {
    if (container instanceof Y.Array) {
      if (container.length > 0) container.delete(0, 1)
      container.insert(0, [value])
    } else container.set("value", value)
  }
  pair.set("left", left)
  pair.set("right", right)
  root.set("pair", pair)
  assign(left, 1)
  assign(right, 3)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const untouched = getSnapshot(boundObject.untouched)
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  autoDispose(() => apply.mockRestore())
  doc.transact(() => {
    assign(left, 3)
    assign(right, 1)
  })
  expect(getSnapshot(boundObject.pair)).toEqual(pair.toJSON())
  expect(Object.values(boundObject.pair.left)).toEqual([3])
  expect(Object.values(boundObject.pair.right)).toEqual([1])
  expect(getSnapshot(boundObject.untouched)).toBe(untouched)
  expect(apply).toHaveBeenCalledTimes(1)
  expect(apply.mock.calls[0][0]).toBe(boundObject.pair)

  const valid = getSnapshot(boundObject.pair)
  expect(() =>
    doc.transact(() => {
      assign(left, 4)
      assign(right, 2)
    })
  ).toThrow(TypeCheckErrorFailure)
  expect(getSnapshot(boundObject.pair)).toEqual(valid)
})

test.each(["array", "map", "text"])(
  "transactions validate refinements spanning a scalar and %s",
  (kind) => {
    const previous = getGlobalConfig().modelAutoTypeChecking
    setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
    autoDispose(() => setGlobalConfig({ modelAutoTypeChecking: previous }))
    const valueType =
      kind === "array"
        ? types.array(types.number)
        : kind === "map"
          ? types.record(types.number)
          : YjsTextModel
    @testModel("scalar-container-root")
    class Root extends Model({
      pair: tProp(
        types.refinement(
          types.object(() => ({ count: types.number, value: valueType })),
          (pair) =>
            pair.count ===
            (pair.value instanceof YjsTextModel
              ? pair.value.deltaList.length
              : Object.values(pair.value)[0])
        )
      ),
    }) {}
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const pair = new Y.Map()
    const value =
      kind === "array" ? new Y.Array<number>() : kind === "map" ? new Y.Map<number>() : new Y.Text()
    pair.set("count", 1)
    pair.set("value", value)
    root.set("pair", pair)
    if (value instanceof Y.Array) value.insert(0, [1])
    else if (value instanceof Y.Map) value.set("n", 1)
    else value.insert(0, "a")
    const { boundObject, dispose } = bindYjsToMobxKeystone({
      yjsDoc: doc,
      yjsObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    doc.transact(() => {
      pair.set("count", 2)
      if (value instanceof Y.Array) {
        value.delete(0, 1)
        value.insert(0, [2])
      } else if (value instanceof Y.Map) value.set("n", 2)
      else value.insert(1, "b")
    })
    expect(boundObject.pair.count).toBe(2)
    if (boundObject.pair.value instanceof YjsTextModel) {
      expect(boundObject.pair.value.deltaList).toHaveLength(2)
      expect(boundObject.pair.value.text).toBe("ab")
    } else expect(Object.values(boundObject.pair.value)).toEqual([2])
  }
)

test("native map transactions validate completed object refinements", () => {
  const previous = mobxKeystone.getGlobalConfig().modelAutoTypeChecking
  mobxKeystone.setGlobalConfig({
    modelAutoTypeChecking: mobxKeystone.ModelAutoTypeCheckingMode.AlwaysOn,
  })
  autoDispose(() => mobxKeystone.setGlobalConfig({ modelAutoTypeChecking: previous }))

  @testModel("balanced-map-root")
  class Root extends Model({
    pair: tProp(
      types.refinement(
        types.object(() => ({ left: types.number, right: types.number })),
        (pair) => pair.left + pair.right === 4
      )
    ),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const pair = new Y.Map<number>()
  pair.set("left", 1)
  pair.set("right", 3)
  root.set("pair", pair)
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  try {
    doc.transact(() => {
      pair.set("left", 3)
      pair.set("right", 1)
    })
    expect(getSnapshot(boundObject.pair)).toEqual({ left: 3, right: 1 })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][0]).toBe(boundObject.pair)
  } finally {
    apply.mockRestore()
  }
})

test.each([1, 2])("binding recovers after %s rejected native transactions", (failures) => {
  @testModel("type-check-recovery-root")
  class Root extends Model({
    values: tProp(types.refinement(types.array(types.number), (values) => values.length === 2)),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const values = new Y.Array<number>()
  root.set("values", values)
  values.push([1, 2])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  for (let i = 0; i < failures; i++) {
    expect(() => values.push([3 + i])).toThrow(TypeCheckErrorFailure)
    expect(getSnapshot(boundObject.values)).toEqual([1, 2])
  }
  expect(() => values.delete(0, failures)).not.toThrow()
  expect(getSnapshot(boundObject.values)).toEqual(values.toArray())
  expect(boundObject.values).toHaveLength(2)

  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  autoDispose(() => apply.mockRestore())
  doc.transact(() => {
    values.delete(0, 1)
    values.insert(0, [9])
  })
  expect(getSnapshot(boundObject.values)).toEqual(values.toArray())
  expect(apply).not.toHaveBeenCalled()
})

test("a local correction recovers other native fields from a rejected transaction", () => {
  @testModel("local-type-check-recovery-root")
  class Root extends Model({
    values: tProp(types.refinement(types.array(types.number), (values) => values.length === 2)),
    flag: tProp(0),
  }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const values = new Y.Array<number>()
  root.set("values", values)
  values.push([1, 2])
  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  expect(() =>
    doc.transact(() => {
      root.set("flag", 1)
      values.push([3])
    })
  ).toThrow(TypeCheckErrorFailure)
  expect(boundObject.flag).toBe(0)
  mobxKeystone.runUnprotected(() => {
    boundObject.values = [9, 10]
  })
  expect(boundObject.flag).toBe(1)
  expect(getSnapshot(boundObject)).toEqual(root.toJSON())
})
