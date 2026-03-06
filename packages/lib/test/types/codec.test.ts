import type { ObservableSet } from "mobx"
import { _, assert } from "spec.ts"

// @ts-expect-error TypeToStoredData is internal-only.
type _InternalTypeToStoredData = import("../../src").TypeToStoredData

import {
  CodecTypeInfo,
  fromSnapshot,
  getSnapshot,
  getTypeInfo,
  type TypeToData,
  type TypeToSnapshotIn,
  type TypeToSnapshotOut,
  typeCheck,
  types,
} from "../../src"

class Point {
  readonly x: number
  readonly y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

const urlType = types.codec({
  typeName: "url",
  encodedType: types.string,
  is(value): value is URL {
    return value instanceof URL
  },
  transform({ originalValue, cachedTransformedValue }) {
    return cachedTransformedValue ?? new URL(originalValue)
  },
  untransform({ transformedValue, cacheTransformedValue }) {
    if (transformedValue instanceof URL) {
      cacheTransformedValue()
    }
    return transformedValue.toString()
  },
})

const pointType = types.codec({
  typeName: "point",
  encodedType: types.object(() => ({
    x: types.number,
    y: types.number,
  })),
  is(value): value is Point {
    return value instanceof Point
  },
  transform({ originalValue, cachedTransformedValue }) {
    return cachedTransformedValue ?? new Point(originalValue.x, originalValue.y)
  },
  untransform({ transformedValue, cacheTransformedValue }) {
    if (transformedValue instanceof Point) {
      cacheTransformedValue()
    }
    return {
      x: transformedValue.x,
      y: transformedValue.y,
    }
  },
})

test("types.codec helper types and built-ins", () => {
  const mapFromObjectType = types.mapFromObject(types.bigint)
  const mapFromArrayType = types.mapFromArray(types.dateAsIsoString, types.bigint)
  const setFromArrayType = types.setFromArray(types.number)

  assert(_ as TypeToData<typeof types.bigint>, _ as bigint)
  assert(_ as TypeToSnapshotIn<typeof types.bigint>, _ as string)
  assert(_ as TypeToSnapshotOut<typeof types.bigint>, _ as string)

  assert(_ as TypeToData<typeof types.dateAsTimestamp>, _ as Date)
  assert(_ as TypeToSnapshotIn<typeof types.dateAsTimestamp>, _ as number)
  assert(_ as TypeToSnapshotOut<typeof types.dateAsTimestamp>, _ as number)

  assert(_ as TypeToData<typeof types.dateAsIsoString>, _ as Date)
  assert(_ as TypeToSnapshotIn<typeof types.dateAsIsoString>, _ as string)
  assert(_ as TypeToSnapshotOut<typeof types.dateAsIsoString>, _ as string)

  assert(_ as TypeToData<typeof mapFromObjectType>, _ as Map<string, bigint>)
  assert(_ as TypeToSnapshotIn<typeof mapFromObjectType>, _ as Record<string, string>)
  assert(_ as TypeToSnapshotOut<typeof mapFromObjectType>, _ as Record<string, string>)

  assert(_ as TypeToData<typeof mapFromArrayType>, _ as Map<Date, bigint>)
  assert(_ as TypeToSnapshotIn<typeof mapFromArrayType>, _ as Array<[string, string]>)
  assert(_ as TypeToSnapshotOut<typeof mapFromArrayType>, _ as Array<[string, string]>)

  assert(_ as TypeToData<typeof setFromArrayType>, _ as Set<number> | ObservableSet<number>)
  assert(_ as TypeToSnapshotIn<typeof setFromArrayType>, _ as number[])
  assert(_ as TypeToSnapshotOut<typeof setFromArrayType>, _ as number[])

  void (() => {
    // @ts-expect-error codec snapshots must use encoded values, not runtime bigint values
    fromSnapshot(types.bigint, 1n)

    // @ts-expect-error codec array snapshots must use encoded values, not runtime bigint values
    fromSnapshot(types.array(types.bigint), [1n])
  })
})

test("types.codec supports custom scalar and object-valued codecs", () => {
  const parsedUrl = fromSnapshot(urlType, "https://example.com/")
  assert(parsedUrl, _ as URL)
  expect(parsedUrl.href).toBe("https://example.com/")
  expect(getSnapshot(urlType, parsedUrl)).toBe("https://example.com/")
  expect(typeCheck(urlType, parsedUrl)).toBeNull()
  expect(typeCheck(urlType, "https://example.com/" as never)).not.toBeNull()

  const point = fromSnapshot(pointType, {
    x: 10,
    y: 20,
  })
  assert(point, _ as Point)
  expect(point).toBeInstanceOf(Point)
  expect(point.x).toBe(10)
  expect(point.y).toBe(20)
  expect(getSnapshot(pointType, point)).toEqual({
    x: 10,
    y: 20,
  })
  expect(typeCheck(pointType, point)).toBeNull()
  expect(typeCheck(pointType, { x: 10, y: 20 } as never)).not.toBeNull()
})

test("bigint codec is available through the BigInt constructor alias", () => {
  const value = fromSnapshot(BigInt, "123")
  assert(value, _ as bigint)

  expect(value).toBe(123n)
  expect(getSnapshot(BigInt, 456n)).toBe("456")
  expect(typeCheck(BigInt, 789n)).toBeNull()
})

test("codec type info exposes the encoded type", () => {
  const codecTypeInfo = getTypeInfo(types.bigint)

  expect(codecTypeInfo).toBeInstanceOf(CodecTypeInfo)
  expect((codecTypeInfo as CodecTypeInfo).typeName).toBe("bigint")
  expect((codecTypeInfo as CodecTypeInfo).encodedTypeInfo.kind).toBe("string")
})

test("typeCheck rejects wrong runtime values for built-in codecs", () => {
  // bigint codec rejects non-bigint values
  expect(typeCheck(types.bigint, 123 as never)).not.toBeNull()
  expect(typeCheck(types.bigint, "123" as never)).not.toBeNull()
  expect(typeCheck(types.bigint, 123n)).toBeNull()

  // dateAsTimestamp codec rejects non-Date values
  expect(typeCheck(types.dateAsTimestamp, 1000 as never)).not.toBeNull()
  expect(typeCheck(types.dateAsTimestamp, "2026-01-01" as never)).not.toBeNull()
  expect(typeCheck(types.dateAsTimestamp, new Date(1000))).toBeNull()

  // dateAsIsoString codec rejects non-Date values
  expect(typeCheck(types.dateAsIsoString, "2026-01-01T00:00:00.000Z" as never)).not.toBeNull()
  expect(typeCheck(types.dateAsIsoString, 1000 as never)).not.toBeNull()
  expect(typeCheck(types.dateAsIsoString, new Date("2026-01-01T00:00:00.000Z"))).toBeNull()

  // setFromArray codec rejects non-Set values
  expect(typeCheck(types.setFromArray(types.number), [1, 2] as never)).not.toBeNull()
  expect(typeCheck(types.setFromArray(types.number), new Set([1, 2]))).toBeNull()

  // mapFromObject codec rejects non-Map values
  expect(typeCheck(types.mapFromObject(types.number), { a: 1 } as never)).not.toBeNull()
  expect(typeCheck(types.mapFromObject(types.number), new Map([["a", 1]]))).toBeNull()
})

// --- types.skipCheck with codec types ---

test("fromSnapshot through skipCheck preserves codec conversion", () => {
  const skippedBigint = types.skipCheck(types.bigint)
  const value = fromSnapshot(skippedBigint, "123")
  expect(value).toBe(123n)
})

test("getSnapshot through skipCheck preserves codec conversion", () => {
  const skippedBigint = types.skipCheck(types.bigint)
  expect(getSnapshot(skippedBigint, 456n)).toBe("456")
})

test("skipCheck disables validation for codec types but keeps conversions", () => {
  const skippedBigint = types.skipCheck(types.bigint)

  // Validation should pass for any value (skipCheck disables it)
  expect(typeCheck(skippedBigint, 123n)).toBeNull()
  expect(typeCheck(skippedBigint, "not a bigint" as any)).toBeNull()

  // But codec conversion still works for valid values
  expect(fromSnapshot(skippedBigint, "789")).toBe(789n)
  expect(getSnapshot(skippedBigint, 100n)).toBe("100")
})

test("skipCheck with codec inside composite types preserves round-trip", () => {
  const arrayOfSkippedBigint = types.array(types.skipCheck(types.bigint))

  // fromSnapshot converts string[] → bigint[]
  const value = fromSnapshot(arrayOfSkippedBigint, ["10", "20", "30"])
  expect(Array.from(value)).toEqual([10n, 20n, 30n])

  // getSnapshot converts bigint[] → string[]
  expect(getSnapshot(arrayOfSkippedBigint, [10n, 20n, 30n])).toEqual(["10", "20", "30"])

  // Validation skipped on items — wrong item types accepted
  expect(typeCheck(arrayOfSkippedBigint, [10n, "not bigint" as any, 20n])).toBeNull()

  // But non-array still fails (the outer array type is NOT skipCheck)
  expect(typeCheck(arrayOfSkippedBigint, "not an array" as any)).not.toBeNull()
})
