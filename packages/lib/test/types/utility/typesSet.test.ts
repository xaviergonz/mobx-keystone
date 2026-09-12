import { Model, tProp, types } from "../../../src"
import { testModel } from "../../utils"

@testModel("SetCodecOperations")
class Store extends Model({ values: tProp(types.setFromArray(types.bigint)) }) {}

test.each([
  "union",
  "intersection",
  "difference",
  "symmetricDifference",
  "isSubsetOf",
  "isSupersetOf",
  "isDisjointFrom",
] as const)("codec sets match native %s results and iteration order", (method) => {
  const root = new Store({ values: new Set([1n, 2n]) })
  const other = new Set([2n, 3n])
  const expected = new Set([1n, 2n])[method](other)
  const actual = root.values[method](other)
  if (expected instanceof Set) {
    expect(Array.from(actual as Set<bigint>)).toEqual(Array.from(expected))
  } else {
    expect(actual).toBe(expected)
  }
  expect(Array.from(root.values)).toEqual([1n, 2n])
})

test("boolean predicates use codec-set membership for equivalent dates", () => {
  @testModel("DateSetPredicates")
  class Dates extends Model({ values: tProp(types.setFromArray(types.dateAsTimestamp)) }) {}
  const root = new Dates({ values: new Set([new Date(1), new Date(2)]) })
  const other = new Set([new Date(1)])
  expect(root.values.has([...other][0])).toBe(true)
  expect(root.values.isSupersetOf(other)).toBe(true)
  expect(root.values.isDisjointFrom(other)).toBe(false)
})

test.each(["isSubsetOf", "isSupersetOf", "isDisjointFrom", "intersection"] as const)(
  "%s does not decode the entire set for a small operand",
  (method) => {
    const decode = vi.fn(({ originalValue }: { originalValue: string }) => BigInt(originalValue))
    const valueType = types.codec({
      typeName: "countedBigint",
      encodedType: types.string,
      is: (value): value is bigint => typeof value === "bigint",
      transform: decode,
      untransform: ({ transformedValue }) => String(transformedValue),
    })
    @testModel(`LazySetPredicate/${method}`)
    class Counted extends Model({ values: tProp(types.setFromArray(valueType)) }) {}
    const root = new Counted({ values: new Set(Array.from({ length: 100 }, (_, i) => BigInt(i))) })
    decode.mockClear()
    const actual = root.values[method](new Set([1n]))
    if (actual instanceof Set) {
      expect([...actual]).toEqual([1n])
    } else {
      expect(actual).toBe(method === "isSupersetOf")
    }
    expect(decode).not.toHaveBeenCalled()
  }
)

test.each(["union", "intersection", "difference", "symmetricDifference"] as const)(
  "%s works without native set methods",
  (method) => {
    const root = new Store({ values: new Set([1n, 2n]) })
    const other = new Set([2n, 3n])
    const expected = [...new Set([1n, 2n])[method](other)]
    const native = vi.spyOn(Set.prototype, method).mockImplementation(() => {
      throw new Error("native method unavailable")
    })
    let actual: bigint[]
    try {
      actual = [...root.values[method](other)]
    } finally {
      native.mockRestore()
    }
    expect(actual).toEqual(expected)
  }
)

test("intersection uses codec membership without decoding the source", () => {
  @testModel("DateSetIntersection")
  class Dates extends Model({ values: tProp(types.setFromArray(types.dateAsTimestamp)) }) {}
  const root = new Dates({ values: new Set([new Date(1), new Date(2)]) })
  const date = new Date(1)
  const result = root.values.intersection(new Set([date]))
  expect([...result]).toEqual([date])
  expect([...result][0]).toBe(date)
})
