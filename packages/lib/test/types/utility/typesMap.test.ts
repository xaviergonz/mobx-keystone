import { Model, runUnprotected, tProp, types } from "../../../src"
import { resolveCodecSupport } from "../../../src/types/utility/typesCodecSupport"
import { getMobxVersion } from "../../../src/utils"
import { testModel } from "../../utils"

test("map codecs preserve __proto__ keys", () => {
  const type = types.mapFromObject(types.bigint)
  const values = new Map([["__proto__", 1n]])
  const encoded = resolveCodecSupport(type).adapter.toStored(values)
  expect(Object.hasOwn(encoded, "__proto__")).toBe(true)
  expect(Reflect.get(encoded, "__proto__")).toBe("1")
  // MobX 4 cannot create an observable __proto__ property.
  if (getMobxVersion() === 4) return
  @testModel("MapCodecSpecialKeys")
  class Store extends Model({ values: tProp(types.mapFromObject(types.bigint)) }) {}
  const root = new Store({ values: new Map([["__proto__", 1n]]) })
  expect(root.values.has("__proto__")).toBe(true)
  expect(root.values.get("__proto__")).toBe(1n)
  expect(Object.hasOwn(root.$.values, "__proto__")).toBe(true)
})

test.each([
  ["object", false],
  ["object", true],
  ["array", false],
  ["array", true],
] as const)(
  "%s-backed map insertion returns the stored codec view (computed: %s)",
  (backing, computed) => {
    const valueType = types.array(types.bigint)
    const mapType =
      backing === "object"
        ? types.mapFromObject(valueType)
        : types.mapFromArray(types.string, valueType)
    @testModel(`MapCodecInsertion/${backing}`)
    class Store extends Model({ values: tProp(mapType) }) {}
    const root = new Store({ values: new Map() })
    runUnprotected(() => {
      const key = String(computed)
      const inserted = computed
        ? root.values.getOrInsertComputed(key, () => [1n])
        : root.values.getOrInsert(key, [1n])
      expect(inserted).toBe(root.values.get(key))
      inserted.push(2n)
      expect(Array.from(root.values.get(key)!)).toEqual([1n, 2n])
    })
  }
)
