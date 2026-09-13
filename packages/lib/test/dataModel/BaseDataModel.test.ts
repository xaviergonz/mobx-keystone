import {
  DataModel,
  ExtendedDataModel,
  getSnapshot,
  prop,
  TypeCheckErrorFailure,
  toTreeNode,
  tProp,
} from "../../src"
import { getMobxVersion } from "../../src/utils"
import { testModel } from "../utils"

@testModel("DataModelDiagnosticsAndCache")
class Item extends DataModel({ value: tProp(1) }) {}

test("data models stringify their backing data", () => {
  const item = new Item({ value: 2 })
  expect(item.toString({ withData: undefined })).toBe(item.toString())
  expect(item.toString()).toContain('"value":2')
  expect(item.toString({ withData: false })).not.toContain('"value":2')
})

test("failed data-model construction is not cached", () => {
  const data = toTreeNode({ value: "invalid" })
  expect(() => new Item(data as unknown as { value: number })).toThrow(TypeCheckErrorFailure)
  expect(() => new Item(data as unknown as { value: number })).toThrow(TypeCheckErrorFailure)
})

test("reusing a data-model instance does not rerun fields or onLazyInit", () => {
  let fieldInitializations = 0
  let hookCalls = 0
  @testModel("CachedDataModelInitialization")
  class Cached extends DataModel({ value: tProp(1) }) {
    initialized = ++fieldInitializations
    onLazyInit() {
      hookCalls++
    }
  }
  const first = new Cached({})
  const second = new Cached(first.$)
  expect(second).toBe(first)
  expect(fieldInitializations).toBe(1)
  expect(hookCalls).toBe(1)
})

test("a failed lazy initializer does not leave a cached data-model instance", () => {
  let failed: Broken | undefined
  @testModel("FailedLazyDataModelInitialization")
  class Broken extends DataModel({ value: tProp(1) }) {
    onLazyInit() {
      if (!failed) {
        failed = this
        throw new Error("initialization failed")
      }
    }
  }
  const data = toTreeNode({ value: 1 })
  expect(() => new Broken(data)).toThrow("initialization failed")
  expect(new Broken(data)).not.toBe(failed)
})

test("extended data models initialize only once and cache separately from their base", () => {
  let baseInitializations = 0
  let extendedInitializations = 0
  @testModel("CachedBaseDataModel")
  class Base extends DataModel({ value: tProp(1) }) {
    baseField = ++baseInitializations
  }
  @testModel("CachedExtendedDataModel")
  class Extended extends ExtendedDataModel(Base, { extra: tProp(2) }) {
    extendedField = ++extendedInitializations
  }
  const first = new Extended({})
  expect(new Extended(first.$)).toBe(first)
  expect(baseInitializations).toBe(1)
  expect(extendedInitializations).toBe(1)
  const base = new Base(first.$)
  expect(base).not.toBe(first)
  expect(new Base(first.$)).toBe(base)
  expect(baseInitializations).toBe(2)
})

@testModel("DataModelProtoDefault")
class ProtoItem extends DataModel({ ["__proto__"]: tProp(123) }) {}

test.skipIf(getMobxVersion() === 4)("defaults apply to data properties named __proto__", () => {
  const item = new ProtoItem({})
  // biome-ignore lint/suspicious/noProto: test an own data property with this name.
  expect(item.$.__proto__).toBe(123)
  expect(Object.hasOwn(getSnapshot(item.$), "__proto__")).toBe(true)
})

// `toString` / `valueOf` exist on Object.prototype, so reading them off the initial data
// object must not be mistaken for a provided value.
@testModel("InheritedNamePropDataModel")
class InheritedNameItem extends DataModel({
  toString: prop<number | undefined>(),
  valueOf: prop(7),
}) {}

// MobX 4 stores observable values in a plain object keyed by property name, so these
// names cannot round-trip through it at all.
test.skipIf(getMobxVersion() === 4)(
  "data properties named after Object.prototype members ignore it",
  () => {
    const item = new InheritedNameItem({} as never)
    expect(item.$.toString).toBe(undefined)
    expect(Object.hasOwn(item.$, "toString")).toBe(true)
    // the default must still be applied rather than shadowed by Object.prototype.valueOf
    expect(item.$.valueOf).toBe(7)
  }
)
