import { fromSnapshot, getSnapshot, idProp, Model, prop, tProp } from "../../src"
import { getMobxVersion } from "../../src/utils"
import { testModel } from "../utils"

@testModel("ModelProtoDefault")
class Item extends Model({ ["__proto__"]: tProp(123) }) {}

test.skipIf(getMobxVersion() === 4)("defaults apply to model properties named __proto__", () => {
  const item = new Item({})
  // biome-ignore lint/suspicious/noProto: test an own data property with this name.
  expect(item.$.__proto__).toBe(123)
  expect(Object.hasOwn(getSnapshot(item), "__proto__")).toBe(true)
})

test.skipIf(getMobxVersion() === 4)("snapshot construction applies __proto__ defaults", () => {
  const item = fromSnapshot(Item, { $modelType: "ModelProtoDefault" })
  // biome-ignore lint/suspicious/noProto: test an own data property with this name.
  expect(item.$.__proto__).toBe(123)
  expect(Object.hasOwn(getSnapshot(item), "__proto__")).toBe(true)
})

// `toString` / `valueOf` exist on Object.prototype, so reading them off the initial data
// object must not be mistaken for a provided value.
@testModel("InheritedNamePropModel")
class InheritedNameItem extends Model({
  toString: prop<number | undefined>(),
  valueOf: prop(7),
}) {}

// MobX 4 stores observable values in a plain object keyed by property name, so these
// names cannot round-trip through it at all.
test.skipIf(getMobxVersion() === 4).each([
  ["new", () => new InheritedNameItem({} as never)],
  [
    "fromSnapshot",
    () => fromSnapshot<InheritedNameItem>({ $modelType: "InheritedNamePropModel" } as never),
  ],
])("properties named after Object.prototype members ignore it (%s)", (_name, create) => {
  const item = create()
  expect(item.$.toString).toBe(undefined)
  expect(Object.hasOwn(item.$, "toString")).toBe(true)
  // the default must still be applied rather than shadowed by Object.prototype.valueOf
  expect(item.$.valueOf).toBe(7)
})

@testModel("InheritedNameIdProperty")
class InheritedNameIdItem extends Model({ toString: idProp }) {}

test.skipIf(getMobxVersion() === 4)(
  "ID properties named after Object.prototype members are generated",
  () => {
    expect(typeof new InheritedNameIdItem({} as never).$.toString).toBe("string")
  }
)

test("a snapshot missing an ID property named after an Object.prototype member is rejected", () => {
  expect(() =>
    fromSnapshot<InheritedNameIdItem>({ $modelType: "InheritedNameIdProperty" } as never)
  ).toThrow(/must contain an id key/)
})
