import { Model, tProp, types } from "../../../src"
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
