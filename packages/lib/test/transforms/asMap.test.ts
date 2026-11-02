import { Model, objectToMapTransform, prop, runUnprotected } from "../../src"
import { getMobxVersion } from "../../src/utils"
import { testModel } from "../utils"

test("object-to-map transforms preserve __proto__ entries when encoding", () => {
  const transform = objectToMapTransform<number>()
  const stored = transform.untransform({
    transformedValue: new Map([["__proto__", 123]]),
    cacheTransformedValue() {},
  })
  expect(Object.hasOwn(stored, "__proto__")).toBe(true)
  expect(Reflect.get(stored, "__proto__")).toBe(123)
  expect(Object.getPrototypeOf(stored)).toBe(Object.prototype)
})

test.each(["toString", "constructor", "hasOwnProperty", "__proto__"])(
  "object-to-map transforms do not see the inherited %s property as an entry",
  (key) => {
    @testModel(`ObjectToMapInheritedKeys/${key}`)
    class Store extends Model({
      values: prop<Record<string, number>>(() => ({ a: 1 })).withTransform(objectToMapTransform()),
    }) {}
    const root = new Store({})
    expect(root.values.has(key)).toBe(false)
    expect(root.values.get(key)).toBe(undefined)
    expect(root.values.size).toBe(1)

    // MobX 4 cannot add observable properties named like inherited ones.
    if (getMobxVersion() === 4) return
    runUnprotected(() => {
      root.values.set(key, 2)
    })
    expect(root.values.get(key)).toBe(2)
    expect(Object.hasOwn(root.$.values, key)).toBe(true)
    runUnprotected(() => {
      expect(root.values.delete(key)).toBe(true)
    })
    expect(root.values.has(key)).toBe(false)
  }
)
