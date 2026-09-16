import { expectTypeOf } from "expect-type"
import {
  type ArraySet,
  fromSnapshot,
  Model,
  modelIdKey,
  modelTypeKey,
  type ObjectMap,
  prop,
  type SnapshotInOf,
  type SnapshotOutOf,
} from "../../src"
import { testModel } from "../utils"

@testModel("CollectionSnapshotDefaults")
class Item extends Model({ value: prop(1) }) {}

test("ObjectMap input snapshots allow item defaults", () => {
  expectTypeOf<NonNullable<SnapshotInOf<ObjectMap<Item>>["items"]>[string]>().toEqualTypeOf<
    SnapshotInOf<Item>
  >()
  expectTypeOf<SnapshotOutOf<ObjectMap<Item>>["items"][string]>().toEqualTypeOf<
    SnapshotOutOf<Item>
  >()

  const input: SnapshotInOf<ObjectMap<Item>> = {
    [modelTypeKey]: "mobx-keystone/ObjectMap",
    [modelIdKey]: "map-id",
    items: { item: { [modelTypeKey]: "CollectionSnapshotDefaults" } },
  }
  const restored = fromSnapshot<ObjectMap<Item>>(input)
  expect(restored.get("item")!.value).toBe(1)
  expect(restored[modelIdKey]).toBe(input[modelIdKey])
})

test("ArraySet input snapshots allow item defaults", () => {
  expectTypeOf<NonNullable<SnapshotInOf<ArraySet<Item>>["items"]>[number]>().toEqualTypeOf<
    SnapshotInOf<Item>
  >()
  expectTypeOf<SnapshotOutOf<ArraySet<Item>>["items"][number]>().toEqualTypeOf<
    SnapshotOutOf<Item>
  >()

  const input: SnapshotInOf<ArraySet<Item>> = {
    [modelTypeKey]: "mobx-keystone/ArraySet",
    [modelIdKey]: "set-id",
    items: [{ [modelTypeKey]: "CollectionSnapshotDefaults" }],
  }
  const restored = fromSnapshot<ArraySet<Item>>(input)
  expect(Array.from(restored)[0].value).toBe(1)
  expect(restored[modelIdKey]).toBe(input[modelIdKey])
})
