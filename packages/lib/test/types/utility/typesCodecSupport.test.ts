import { Model, runUnprotected, tProp, types } from "../../../src"
import { resolveCodecSupport } from "../../../src/types/utility/typesCodecSupport"
import { getMobxVersion } from "../../../src/utils"
import { testModel } from "../../utils"

@testModel("CodecArraySemantics")
class Store extends Model({ values: tProp(types.array(types.bigint), () => [1n, 2n, 3n]) }) {}

test.each([[], [1], [1, undefined], [1, undefined, 9n], [0.8, 1.8], [Number.NaN, 1]])(
  "codec splice matches native splice with arguments %j",
  (...args) => {
    const root = new Store({})
    const native = [1n, 2n, 3n]
    const expected = Reflect.apply(native.splice, native, args)
    const removed = runUnprotected(() => Reflect.apply(root.values.splice, root.values, args))
    expect(Array.from(removed)).toEqual(expected)
    expect(Array.from(root.values)).toEqual(native)
  }
)

test.each([0.9, -1.9, Number.NaN, undefined, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  "codec at matches native at for %s",
  (index) => {
    const root = new Store({})
    expect(Reflect.apply(root.values.at, root.values, [index])).toBe(
      Reflect.apply([1n, 2n, 3n].at, [1n, 2n, 3n], [index])
    )
  }
)

test("large codec array reversals do not exceed the argument limit", () => {
  const root = new Store({ values: Array.from({ length: 150000 }, (_, i) => BigInt(i)) })
  expect(root.values.slice(0, 2)).toEqual([0n, 1n])
  runUnprotected(() => root.values.reverse())
  expect(root.values.length).toBe(150000)
  expect(root.values[0]).toBe(149999n)
  expect(root.values[149999]).toBe(0n)
}, 30000)

test("mutable codec inputs are re-encoded when reused", () => {
  @testModel("MutableCodecInput")
  class Dates extends Model({ values: tProp(types.array(types.dateAsTimestamp)) }) {}
  const date = new Date(1)
  const root = new Dates({ values: [date] })
  date.setTime(2)
  runUnprotected(() => root.values.push(date))
  expect(root.$.values[0]).toBe(1)
  expect(root.$.values[1]).toBe(2)
})

test.each(["object", "record"] as const)("%s codecs preserve special own keys", (kind) => {
  const type =
    kind === "object"
      ? types.object(() => ({ ["__proto__"]: types.bigint, constructor: types.bigint }))
      : types.record(types.bigint)
  const values = { ["__proto__"]: 1n, constructor: 2n }
  const encoded = resolveCodecSupport(type).adapter.toStored(values)
  expect(Object.hasOwn(encoded, "__proto__")).toBe(true)
  expect(Reflect.get(encoded, "__proto__")).toBe("1")
  expect(encoded.constructor).toBe("2")
  // MobX 4 cannot create observable properties with these names.
  if (getMobxVersion() === 4) return
  @testModel(`CodecSpecialKeys/${kind}`)
  class Values extends Model({ values: tProp(type) }) {}
  const root = new Values({ values: { ["__proto__"]: 1n, constructor: 2n } })
  expect(Reflect.get(root.values, "__proto__")).toBe(1n)
  expect(root.values.constructor).toBe(2n)
  expect(Object.hasOwn(root.$.values, "__proto__")).toBe(true)
  expect(Reflect.get(root.$.values, "__proto__")).toBe("1")
})
