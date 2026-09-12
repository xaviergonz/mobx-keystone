import {
  isSetLikeDisjointFrom,
  isSetLikeSubsetOf,
  isSetLikeSupersetOf,
  setLikeDifference,
  setLikeIntersection,
  setLikeSymmetricDifference,
  setLikeUnion,
} from "../../src/utils/setLike"

const methods = [
  ["isSubsetOf", isSetLikeSubsetOf],
  ["isSupersetOf", isSetLikeSupersetOf],
  ["isDisjointFrom", isSetLikeDisjointFrom],
] as const

test.each(methods)("%s matches native results", (name, predicate) => {
  for (const a of [[], [1], [1, 2], [Number.NaN, 0]]) {
    for (const b of [[], [1], [2, 3], [Number.NaN, -0]]) {
      const left = new Set(a)
      const right = new Set(b)
      expect(predicate(left, right)).toBe(left[name](right))
    }
  }
})

test.each(methods)(
  "%s validates all set-like methods before size shortcuts",
  (_name, predicate) => {
    for (const other of [null, {}, { size: -1 }, { size: Number.NaN }, { size: 0, has() {} }]) {
      expect(() => predicate(new Set(), other as never)).toThrow()
    }
  }
)

test.each(methods)("%s reads methods once and preserves their receiver", (_name, predicate) => {
  const reads: string[] = []
  const other = {
    get size() {
      reads.push("size")
      return 1
    },
    get has() {
      reads.push("has")
      return function (this: unknown, value: unknown) {
        expect(this).toBe(other)
        return value === 1
      }
    },
    get keys() {
      reads.push("keys")
      return function (this: unknown) {
        expect(this).toBe(other)
        return [1].values()
      }
    },
  }
  predicate(new Set([1]), other)
  expect(reads).toEqual(["size", "has", "keys"])
})

test("size shortcuts do not iterate", () => {
  const keys = vi.fn(() => {
    throw new Error("unexpected iteration")
  })
  expect(isSetLikeSubsetOf({ size: 2, has: () => true, keys }, new Set([1]))).toBe(false)
  expect(isSetLikeSupersetOf({ size: 0, has: () => false, keys }, new Set([1]))).toBe(false)
  expect(keys).not.toHaveBeenCalled()
})

test("superset and disjoint checks use the smaller operand without copying", () => {
  const keys = vi.fn(() => {
    throw new Error("unexpected iteration")
  })
  const has = vi.fn((value: unknown) => value === 1)
  const large = { size: 100000, keys, has }
  expect(isSetLikeSupersetOf(large, new Set([1]))).toBe(true)
  expect(isSetLikeDisjointFrom(large, new Set([1]))).toBe(false)
  expect(has).toHaveBeenCalledTimes(2)
  expect(keys).not.toHaveBeenCalled()
})

test.each([isSetLikeSupersetOf, isSetLikeDisjointFrom])(
  "closes plain key iterators on early exit",
  (predicate) => {
    const close = vi.fn(() => ({ done: true as const, value: undefined }))
    const other = {
      size: 1,
      has: () => false,
      keys: () => ({ next: () => ({ done: false, value: 1 }), return: close }),
    }
    const source = {
      size: 2,
      has: () => predicate === isSetLikeDisjointFrom,
      keys: () => [1, 2].values(),
    }
    expect(predicate(source, other)).toBe(false)
    expect(close).toHaveBeenCalledOnce()
  }
)

test.each(methods)(
  "%s matches native size coercion and invalid argument rejection",
  (name, predicate) => {
    for (const size of [
      -0.5,
      1.9,
      "1",
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      -1,
      1n,
      null,
      undefined,
    ]) {
      const other = { size, has: () => false, keys: () => [3].values() } as ReadonlySetLike<number>
      const source = new Set([1, 2])
      let expected: boolean
      try {
        expected = source[name](other)
      } catch {
        expect(() => predicate(source, other)).toThrow()
        continue
      }
      expect(predicate(source, other)).toBe(expected)
    }
  }
)

const collectionMethods: ReadonlyArray<
  readonly [
    "union" | "intersection" | "difference" | "symmetricDifference",
    (set: ReadonlySetLike<unknown>, other: ReadonlySetLike<unknown>) => Set<unknown>,
  ]
> = [
  ["union", setLikeUnion],
  ["intersection", setLikeIntersection],
  ["difference", setLikeDifference],
  ["symmetricDifference", setLikeSymmetricDifference],
] as const

test.each(collectionMethods)("%s matches native contents and order", (name, operation) => {
  const object = {}
  for (const a of [[], [1], [2, 1], [1, 2, 3, 4], [Number.NaN, -0, object]]) {
    for (const b of [[], [1], [3, 2], [4, 3, 2, 1], [object, 0, Number.NaN]]) {
      const left = new Set(a)
      const right = new Set(b)
      expect([...operation(left, right)]).toEqual([...left[name](right)])
      expect([...left]).toEqual([...new Set(a)])
      expect([...right]).toEqual([...new Set(b)])
    }
  }
})

test.each(collectionMethods)("%s accepts plain iterators and duplicate keys", (name, operation) => {
  for (const size of [1, 10]) {
    const other = {
      size,
      has: (value: unknown) => value === 2 || value === 3,
      keys: () => {
        const iterator = [3, 2, 3, 2].values()
        return { next: () => iterator.next() }
      },
    }
    const source = new Set([1, 2])
    expect([...operation(source, other)]).toEqual([...source[name](other)])
  }
})

test.each(collectionMethods)(
  "%s validates the set-like argument before iterating",
  (_name, operation) => {
    const keys = vi.fn(() => {
      throw new Error("unexpected iteration")
    })
    for (const other of [null, {}, { size: -1 }, { size: Number.NaN }, { size: 0, has() {} }]) {
      expect(() => operation({ size: 0, has: () => false, keys }, other as never)).toThrow()
    }
    expect(keys).not.toHaveBeenCalled()
  }
)

test("intersection only visits the smaller operand", () => {
  const keys = vi.fn(() => {
    throw new Error("unexpected iteration")
  })
  const has = vi.fn((value: number) => value === 2)
  expect([...setLikeIntersection({ size: 100000, has, keys }, new Set([3, 2]))]).toEqual([2])
  expect(has).toHaveBeenCalledTimes(2)
  expect(keys).not.toHaveBeenCalled()
})
