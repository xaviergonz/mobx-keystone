import { Model, runUnprotected, TypeCheckErrorFailure, tProp, types } from "../../../src"
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

const positiveBigint = types.refinement(types.bigint, (value) => value > 0n, "positiveBigint")

@testModel("CodecRefinement")
class RefinedStore extends Model({ value: tProp(positiveBigint) }) {}

test("codec refinements reject invalid initial values", () => {
  expect(() => new RefinedStore({ value: -1n })).toThrow(TypeCheckErrorFailure)
})

test("codec refinements reject and roll back invalid writes", () => {
  const root = new RefinedStore({ value: 1n })
  expect(() =>
    runUnprotected(() => {
      root.value = -1n
    })
  ).toThrow(TypeCheckErrorFailure)
  expect(root.value).toBe(1n)
})

test("custom codec writes do not leave stale reverse-cache entries", () => {
  const counterType = types.codec({
    typeName: "counter",
    encodedType: types.number,
    is(value): value is { value: number } {
      return typeof value === "object" && value !== null && "value" in value
    },
    transform({ originalValue, setOriginalValue }) {
      let current = originalValue
      return {
        get value() {
          return current
        },
        set value(value: number) {
          setOriginalValue(value)
          current = value
        },
      }
    },
    untransform({ transformedValue }) {
      return transformedValue.value
    },
  })
  @testModel("WritableCodecCache")
  class Counters extends Model({ values: tProp(types.array(counterType)) }) {}
  const root = new Counters({ values: [{ value: 1 }] })
  runUnprotected(() => {
    const counter = root.values[0]
    counter.value = 2
    root.values.push(counter)
  })
  expect(Array.from(root.$.values)).toEqual([2, 2])
})

test("codec arrays leave non-index numeric property names unconverted", () => {
  const adapter = resolveCodecSupport(types.array(types.bigint)).adapter
  const stored = ["1"]
  const keys = [
    "",
    "01",
    "1.0",
    "1e0",
    "0x1",
    " 1",
    "1 ",
    "-0",
    "-1",
    "Infinity",
    "NaN",
    "4294967295",
    "9007199254740992",
    Symbol("metadata"),
  ]
  for (const key of keys) Reflect.set(stored, key, "metadata")
  const runtime = adapter.toRuntime(stored)
  for (const key of keys) {
    expect(Reflect.get(runtime, key)).toBe("metadata")
    Reflect.set(runtime, key, "changed")
    expect(Reflect.get(stored, key)).toBe("changed")
  }
  expect(stored).toHaveLength(1)
})

test.each(["array", "object", "record"] as const)(
  "%s codec proxies report failed property writes",
  (kind) => {
    const type =
      kind === "array"
        ? types.array(types.bigint)
        : kind === "object"
          ? types.object(() => ({ value: types.bigint }))
          : types.record(types.bigint)
    const stored = kind === "array" ? ["1"] : { value: "1" }
    Object.preventExtensions(stored)
    const runtime = resolveCodecSupport(type).adapter.toRuntime(stored)
    expect(Reflect.set(runtime, Symbol("extra"), 1)).toBe(false)
  }
)

test("codec array reversal preserves holes in plain stored arrays", () => {
  const stored = new Array(3)
  stored[0] = "1"
  const runtime = resolveCodecSupport(types.array(types.bigint)).adapter.toRuntime(stored)
  runtime.reverse()
  expect(stored).toHaveLength(3)
  expect(0 in stored).toBe(false)
  expect(1 in stored).toBe(false)
  expect(stored[2]).toBe("1")
})

test("encoding a plain sparse codec array preserves holes", () => {
  const runtime = new Array(3)
  runtime[1] = 2n
  const stored = resolveCodecSupport(types.array(types.bigint)).adapter.toStored(runtime)
  expect(stored).toHaveLength(3)
  expect(0 in stored).toBe(false)
  expect(stored[1]).toBe("2")
  expect(2 in stored).toBe(false)
})
