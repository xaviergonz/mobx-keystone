import type { ObservableSet } from "mobx"
import { _, assert } from "spec.ts"
import {
  fromSnapshot,
  getSnapshot,
  isArray,
  runUnprotected,
  TypeToData,
  TypeToSnapshotIn,
  TypeToSnapshotOut,
  types,
} from "../../src"

test("typed snapshot APIs round-trip nested codec schemas", () => {
  const infoType = types.object(() => ({
    createdAt: types.dateAsTimestamp,
    counts: types.mapFromObject(types.bigint),
    keyed: types.mapFromArray(types.dateAsIsoString, types.bigint),
    ids: types.array(types.bigint),
    tags: types.setFromArray(types.number),
  }))

  assert(
    _ as TypeToData<typeof infoType>,
    _ as {
      createdAt: Date
      counts: Map<string, bigint>
      keyed: Map<Date, bigint>
      ids: bigint[]
      tags: Set<number> | ObservableSet<number>
    }
  )

  assert(
    _ as TypeToSnapshotIn<typeof infoType>,
    _ as {
      createdAt: number
      counts: Record<string, string>
      keyed: Array<[string, string]>
      ids: string[]
      tags: number[]
    }
  )

  assert(
    _ as TypeToSnapshotOut<typeof infoType>,
    _ as {
      createdAt: number
      counts: Record<string, string>
      keyed: Array<[string, string]>
      ids: string[]
      tags: number[]
    }
  )

  const info = fromSnapshot(infoType, {
    createdAt: 1000,
    counts: {
      a: "2",
    },
    keyed: [["2026-01-01T00:00:00.000Z", "3"]],
    ids: ["1"],
    tags: [5],
  })

  expect(info.createdAt).toBeInstanceOf(Date)
  expect(+info.createdAt).toBe(1000)
  expect(info.counts.get("a")).toBe(2n)
  expect(info.ids[0]).toBe(1n)
  expect(info.keyed.get(new Date("2026-01-01T00:00:00.000Z"))).toBe(3n)
  expect(info.tags.has(5)).toBe(true)

  runUnprotected(() => {
    const removed = info.ids.splice(0, 1, 4n)
    expect(removed).toEqual([1n])

    info.counts.set("b", 6n)
    info.keyed.set(new Date("2026-01-02T00:00:00.000Z"), 7n)
    info.tags.add(8)
  })

  expect(getSnapshot(infoType, info)).toEqual({
    createdAt: 1000,
    counts: {
      a: "2",
      b: "6",
    },
    keyed: [
      ["2026-01-01T00:00:00.000Z", "3"],
      ["2026-01-02T00:00:00.000Z", "7"],
    ],
    ids: ["4"],
    tags: [5, 8],
  })
})

test("typed snapshot APIs support array and record runtime views", () => {
  const idsType = types.array(types.bigint)
  const recordType = types.record(types.bigint)

  const ids = fromSnapshot(idsType, ["1", "2"])
  assert(ids, _ as bigint[])

  expect(isArray(ids)).toBe(true)
  expect(ids[0]).toBe(1n)
  expect(ids[1]).toBe(2n)

  runUnprotected(() => {
    ids[1] = 5n
    ids.push(8n)
  })

  expect(getSnapshot(idsType, ids)).toEqual(["1", "5", "8"])

  const record = fromSnapshot(recordType, {
    a: "3",
  })
  assert(record, _ as Record<string, bigint>)

  expect(record.a).toBe(3n)
  runUnprotected(() => {
    record.b = 4n
    delete record.a
  })

  expect(getSnapshot(recordType, record)).toEqual({
    b: "4",
  })
})

test("typed snapshot APIs support tuple, maybe, and or codec schemas", () => {
  const tupleType = types.tuple(types.bigint, types.dateAsIsoString)
  const maybeType = types.maybe(types.bigint)
  const orType = types.or(types.number, types.bigint)

  assert(_ as TypeToData<typeof tupleType>, _ as [bigint, Date])
  assert(_ as TypeToSnapshotIn<typeof tupleType>, _ as [string, string])
  assert(_ as TypeToSnapshotOut<typeof tupleType>, _ as [string, string])

  assert(_ as TypeToData<typeof maybeType>, _ as bigint | undefined)
  assert(_ as TypeToSnapshotIn<typeof maybeType>, _ as string | undefined)
  assert(_ as TypeToSnapshotOut<typeof maybeType>, _ as string | undefined)

  assert(_ as TypeToData<typeof orType>, _ as number | bigint)
  assert(_ as TypeToSnapshotIn<typeof orType>, _ as number | string)
  assert(_ as TypeToSnapshotOut<typeof orType>, _ as number | string)

  const tuple = fromSnapshot(tupleType, ["1", "2026-01-01T00:00:00.000Z"])
  assert(tuple, _ as [bigint, Date])
  expect(tuple[0]).toBe(1n)
  expect(tuple[1].toISOString()).toBe("2026-01-01T00:00:00.000Z")
  expect(getSnapshot(tupleType, tuple)).toEqual(["1", "2026-01-01T00:00:00.000Z"])

  expect(fromSnapshot(maybeType, "2")).toBe(2n)
  expect(fromSnapshot(maybeType, undefined)).toBeUndefined()
  expect(getSnapshot(maybeType, 3n)).toBe("3")
  expect(getSnapshot(maybeType, undefined)).toBeUndefined()

  expect(fromSnapshot(orType, "4")).toBe(4n)
  expect(fromSnapshot(orType, 5)).toBe(5)
  expect(getSnapshot(orType, 6n)).toBe("6")
  expect(getSnapshot(orType, 7)).toBe(7)
})

test("codec runtime views handle missing lookups and out-of-bounds access", () => {
  const idsType = types.array(types.bigint)
  const mapFromObjectType = types.mapFromObject(types.bigint)
  const mapFromArrayType = types.mapFromArray(types.bigint, types.bigint)

  const ids = fromSnapshot(idsType, ["1"])
  const objectMap = fromSnapshot(mapFromObjectType, {
    a: "2",
  })
  const arrayMap = fromSnapshot(mapFromArrayType, [["1", "3"]])

  expect(ids[5]).toBeUndefined()
  expect(ids.at(5)).toBeUndefined()
  expect(ids.at(-2)).toBeUndefined()
  expect(ids.at(-1)).toBe(1n)

  expect(objectMap.get("missing")).toBeUndefined()
  expect(arrayMap.get(2n)).toBeUndefined()
  expect(arrayMap.get(1n)).toBe(3n)
})

test("codec runtime arrays support read-only array helpers on runtime values", () => {
  const idsType = types.array(types.bigint)
  const ids = fromSnapshot(idsType, ["1", "2", "3"])

  expect(ids.reduce((sum, value) => sum + value, 0n)).toBe(6n)
  expect(ids.reduceRight((sum, value) => sum + value, 0n)).toBe(6n)
  expect(ids.findLast((value) => value % 2n === 1n)).toBe(3n)
  expect(ids.findLastIndex((value) => value % 2n === 1n)).toBe(2)
  expect(ids.concat([4n])).toEqual([1n, 2n, 3n, 4n])
  expect(ids.flatMap((value) => [value, value + 10n])).toEqual([1n, 11n, 2n, 12n, 3n, 13n])
  expect(ids.toReversed()).toEqual([3n, 2n, 1n])
  expect(ids.toSorted((a, b) => (a < b ? 1 : a > b ? -1 : 0))).toEqual([3n, 2n, 1n])
  expect(ids.with(1, 8n)).toEqual([1n, 8n, 3n])
  expect(getSnapshot(idsType, ids)).toEqual(["1", "2", "3"])
})

test("codec runtime arrays support mutating array helpers on runtime values", () => {
  const idsType = types.array(types.bigint)
  const ids = fromSnapshot(idsType, ["10", "2", "3"])

  runUnprotected(() => {
    ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(Array.from(ids)).toEqual([2n, 3n, 10n])

    ids.reverse()
    expect(Array.from(ids)).toEqual([10n, 3n, 2n])

    ids.fill(8n, 1, 2)
    expect(Array.from(ids)).toEqual([10n, 8n, 2n])

    ids.copyWithin(1, 0, 1)
    expect(Array.from(ids)).toEqual([10n, 10n, 2n])
  })

  expect(getSnapshot(idsType, ids)).toEqual(["10", "10", "2"])
})
