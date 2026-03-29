import { _, assert } from "spec.ts"
import {
  applySnapshot,
  clone,
  fromSnapshot,
  getParent,
  getSnapshot,
  Model,
  runUnprotected,
  type SnapshotInOf,
  type SnapshotOutOf,
  TypeCheckError,
  tProp,
  types,
} from "../../src"
import { testModel } from "../utils"

test("codec props keep runtime values while storing encoded data", () => {
  const plainStoredInfo = (info: {
    createdAt: Date | number
    counts: Map<string, bigint> | Record<string, string>
    ids: Iterable<bigint | string>
  }) => ({
    createdAt: info.createdAt instanceof Date ? +info.createdAt : info.createdAt,
    counts:
      info.counts instanceof Map
        ? Object.fromEntries(
            Array.from(info.counts, ([key, value]) => [key, value.toString()] as const)
          )
        : { ...info.counts },
    ids: Array.from(info.ids, (value) => (typeof value === "bigint" ? value.toString() : value)),
  })

  const infoType = types.object(() => ({
    createdAt: types.dateAsTimestamp,
    counts: types.mapFromObject(types.bigint),
    ids: types.array(types.bigint),
  }))

  @testModel("codecProps/runtimeAndStored")
  class M extends Model({
    id: tProp(types.bigint),
    createdAt: tProp(types.dateAsTimestamp),
    settledAt: tProp(types.dateAsIsoString),
    totals: tProp(types.mapFromObject(types.bigint), () => new Map()),
    keyed: tProp(types.mapFromArray(types.dateAsIsoString, types.bigint), () => new Map()),
    flags: tProp(types.setFromArray(types.number), () => new Set<number>()),
    ids: tProp(types.array(types.bigint), () => []),
    info: tProp(infoType),
  }) {}

  const model = new M({
    id: 1n,
    createdAt: new Date(1000),
    settledAt: new Date("2026-01-01T00:00:00.000Z"),
    totals: new Map([["a", 2n]]),
    keyed: new Map([[new Date("2026-01-01T00:00:00.000Z"), 3n]]),
    flags: new Set([4]),
    ids: [5n],
    info: {
      createdAt: new Date(2000),
      counts: new Map([["b", 6n]]),
      ids: [7n],
    },
  })

  assert(
    model.$,
    _ as {
      id: string
      createdAt: number
      settledAt: string
      totals: Record<string, string>
      keyed: Array<[string, string]>
      flags: number[]
      ids: string[]
      info: {
        createdAt: number
        counts: Record<string, string>
        ids: string[]
      }
    }
  )

  assert(_ as SnapshotInOf<M>["id"], _ as string)
  assert(_ as SnapshotInOf<M>["createdAt"], _ as number)
  assert(_ as SnapshotInOf<M>["settledAt"], _ as string)
  assert(_ as SnapshotInOf<M>["totals"], _ as Record<string, string> | null | undefined)
  assert(_ as SnapshotInOf<M>["keyed"], _ as Array<[string, string]> | null | undefined)
  assert(_ as SnapshotInOf<M>["flags"], _ as number[] | null | undefined)
  assert(_ as SnapshotInOf<M>["ids"], _ as string[] | null | undefined)
  assert(_ as SnapshotInOf<M>["info"]["createdAt"], _ as number)
  assert(_ as SnapshotInOf<M>["info"]["counts"], _ as Record<string, string>)
  assert(_ as SnapshotInOf<M>["info"]["ids"], _ as string[])

  assert(_ as SnapshotOutOf<M>["id"], _ as string)
  assert(_ as SnapshotOutOf<M>["createdAt"], _ as number)
  assert(_ as SnapshotOutOf<M>["settledAt"], _ as string)
  assert(_ as SnapshotOutOf<M>["totals"], _ as Record<string, string>)
  assert(_ as SnapshotOutOf<M>["keyed"], _ as Array<[string, string]>)
  assert(_ as SnapshotOutOf<M>["flags"], _ as number[])
  assert(_ as SnapshotOutOf<M>["ids"], _ as string[])
  assert(_ as SnapshotOutOf<M>["info"]["createdAt"], _ as number)
  assert(_ as SnapshotOutOf<M>["info"]["counts"], _ as Record<string, string>)
  assert(_ as SnapshotOutOf<M>["info"]["ids"], _ as string[])

  assert(model.id, _ as bigint)
  assert(model.createdAt, _ as Date)
  assert(model.totals, _ as Map<string, bigint>)
  assert(model.ids, _ as bigint[])
  assert(model.info, _ as { createdAt: Date; counts: Map<string, bigint>; ids: bigint[] })
  expect(model.id).toBe(1n)
  expect(+model.createdAt).toBe(1000)
  expect(model.settledAt.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  expect(model.totals.get("a")).toBe(2n)
  expect(model.keyed.get(new Date("2026-01-01T00:00:00.000Z"))).toBe(3n)
  expect(model.flags.has(4)).toBe(true)
  expect(model.ids[0]).toBe(5n)
  expect(+model.info.createdAt).toBe(2000)
  expect(model.info.counts.get("b")).toBe(6n)
  expect(model.info.ids[0]).toBe(7n)
  expect(model.$.id).toBe("1")
  expect(model.$.createdAt).toBe(1000)
  expect(model.$.settledAt).toBe("2026-01-01T00:00:00.000Z")
  expect({ ...model.$.totals }).toEqual({
    a: "2",
  })
  expect(Array.from(model.$.keyed, (entry) => Array.from(entry))).toEqual([
    ["2026-01-01T00:00:00.000Z", "3"],
  ])
  expect(Array.from(model.$.flags)).toEqual([4])
  expect(Array.from(model.$.ids)).toEqual(["5"])
  expect(plainStoredInfo(model.$.info)).toEqual({
    createdAt: 2000,
    counts: {
      b: "6",
    },
    ids: ["7"],
  })

  runUnprotected(() => {
    const removedIds = model.ids.splice(0, 1, 8n)
    expect(removedIds).toEqual([5n])
    model.ids.push(9n)
    model.totals.set("c", 10n)
    model.keyed.set(new Date("2026-01-02T00:00:00.000Z"), 11n)
    model.flags.add(12)
    model.info.createdAt = new Date(3000)
    model.info.counts.set("d", 13n)
    model.info.ids[0] = 14n
  })

  expect(Array.from(model.$.ids)).toEqual(["8", "9"])
  expect({ ...model.$.totals }).toEqual({
    a: "2",
    c: "10",
  })
  expect(Array.from(model.$.keyed, (entry) => Array.from(entry))).toEqual([
    ["2026-01-01T00:00:00.000Z", "3"],
    ["2026-01-02T00:00:00.000Z", "11"],
  ])
  expect(Array.from(model.$.flags)).toEqual([4, 12])
  expect(plainStoredInfo(model.$.info)).toEqual({
    createdAt: 3000,
    counts: {
      b: "6",
      d: "13",
    },
    ids: ["14"],
  })

  const snapshot = getSnapshot(model)
  assert(snapshot, _ as SnapshotOutOf<M>)

  expect(snapshot).toEqual({
    id: "1",
    createdAt: 1000,
    settledAt: "2026-01-01T00:00:00.000Z",
    totals: {
      a: "2",
      c: "10",
    },
    keyed: [
      ["2026-01-01T00:00:00.000Z", "3"],
      ["2026-01-02T00:00:00.000Z", "11"],
    ],
    flags: [4, 12],
    ids: ["8", "9"],
    info: {
      createdAt: 3000,
      counts: {
        b: "6",
        d: "13",
      },
      ids: ["14"],
    },
    $modelType: model.$modelType,
  })

  const restored = fromSnapshot(M, snapshot)
  assert(restored, _ as M)

  expect(restored.id).toBe(1n)
  expect(+restored.createdAt).toBe(1000)
  expect(restored.settledAt.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  expect(restored.totals.get("c")).toBe(10n)
  expect(restored.keyed.get(new Date("2026-01-02T00:00:00.000Z"))).toBe(11n)
  expect(restored.flags.has(12)).toBe(true)
  expect(Array.from(restored.ids)).toEqual([8n, 9n])
  expect(+restored.info.createdAt).toBe(3000)
  expect(restored.info.counts.get("d")).toBe(13n)
  expect(restored.info.ids[0]).toBe(14n)
})

test("applySnapshot updates codec props in-place", () => {
  @testModel("codecProps/applySnapshot")
  class M extends Model({
    id: tProp(types.bigint),
    createdAt: tProp(types.dateAsTimestamp),
    ids: tProp(types.array(types.bigint), () => []),
    totals: tProp(types.mapFromObject(types.bigint), () => new Map()),
  }) {}

  const model = new M({
    id: 1n,
    createdAt: new Date(1000),
    ids: [2n],
    totals: new Map([["a", 3n]]),
  })

  expect(model.id).toBe(1n)
  expect(+model.createdAt).toBe(1000)
  expect(model.ids[0]).toBe(2n)
  expect(model.totals.get("a")).toBe(3n)

  applySnapshot(model, {
    ...getSnapshot(model),
    id: "10",
    createdAt: 2000,
    ids: ["20", "30"],
    totals: { b: "40" },
  })

  expect(model.id).toBe(10n)
  expect(+model.createdAt).toBe(2000)
  expect(Array.from(model.ids)).toEqual([20n, 30n])
  expect(model.totals.get("b")).toBe(40n)
  expect(model.totals.has("a")).toBe(false)
})

test("codec prop defaults are encoded before storing them", () => {
  @testModel("codecProps/defaultEncoding")
  class M extends Model({
    totals: tProp(types.mapFromObject(types.bigint), () => new Map()),
    flags: tProp(types.setFromArray(types.number), () => new Set<number>()),
  }) {}

  const created = new M({})

  expect(created.totals.size).toBe(0)
  expect(created.flags.size).toBe(0)
  expect(created.$.totals).toEqual({})
  expect(Array.from(created.$.flags)).toEqual([])

  const restored = fromSnapshot(M, {
    ...getSnapshot(created),
    totals: undefined,
    flags: undefined,
  })

  expect(restored.totals.size).toBe(0)
  expect(restored.flags.size).toBe(0)
  expect(restored.$.totals).toEqual({})
  expect(Array.from(restored.$.flags)).toEqual([])

  const model = new M({
    totals: new Map([["a", 1n]]),
    flags: new Set([2]),
  })

  applySnapshot(model, {
    $modelType: model.$modelType,
  })

  expect(model.totals.size).toBe(0)
  expect(model.flags.size).toBe(0)
  expect(model.$.totals).toEqual({})
  expect(Array.from(model.$.flags)).toEqual([])

  const reassigned = new M({
    totals: new Map([["b", 3n]]),
    flags: new Set([4]),
  })

  runUnprotected(() => {
    ;(reassigned as any).totals = undefined
    ;(reassigned as any).flags = undefined
  })

  expect(reassigned.totals.size).toBe(0)
  expect(reassigned.flags.size).toBe(0)
  expect(reassigned.$.totals).toEqual({})
  expect(Array.from(reassigned.$.flags)).toEqual([])
})

test("custom codec defaults are encoded before storing them", () => {
  const boxedNumberType = types.codec({
    typeName: "boxedNumber",
    encodedType: types.number,
    is(value): value is { value: number } {
      return (
        typeof value === "object" &&
        value !== null &&
        "value" in value &&
        typeof (value as { value: unknown }).value === "number"
      )
    },
    transform({ originalValue }) {
      return { value: originalValue }
    },
    untransform({ transformedValue }) {
      return transformedValue.value
    },
  })

  @testModel("codecProps/customDefaultEncoding")
  class M extends Model({
    score: tProp(boxedNumberType, () => ({ value: 7 })),
  }) {}

  const created = new M({})
  expect(created.score).toEqual({ value: 7 })
  expect(created.$.score).toBe(7)

  const restored = fromSnapshot(M, {
    ...getSnapshot(created),
    score: undefined,
  })
  expect(restored.score).toEqual({ value: 7 })
  expect(restored.$.score).toBe(7)
})

test("codec default fallback keeps the property path in runtime assignment errors", () => {
  const checkedNumberType = types.codec({
    typeName: "checkedNumber",
    encodedType: types.number,
    is(value): value is number {
      return typeof value === "number"
    },
    transform({ originalValue }) {
      return originalValue
    },
    untransform({ transformedValue }) {
      if (typeof transformedValue !== "number") {
        new TypeCheckError({
          path: [],
          expectedTypeName: "number",
          actualValue: transformedValue,
        }).throw()
      }

      return transformedValue
    },
  })

  @testModel("codecProps/defaultErrorPath")
  class M extends Model({
    score: tProp(checkedNumberType, (() => "bad-default") as unknown as () => number),
  }) {}

  const model = new M({
    score: 1,
  })

  expect(() => {
    runUnprotected(() => {
      ;(model as any).score = undefined
    })
  }).toThrow(
    'TypeCheckError: Expected a value of type <number> but got an incompatible value - Path: /score - Value: "bad-default"'
  )
})

test("typed getSnapshot keeps codec-backed stored nodes attached to the model tree", () => {
  const infoType = types.object(() => ({
    createdAt: types.dateAsTimestamp,
    ids: types.array(types.bigint),
  }))

  @testModel("codecProps/typedGetSnapshotKeepsParents")
  class M extends Model({
    info: tProp(infoType),
    ids: tProp(types.array(types.bigint), () => []),
  }) {}

  const model = new M({
    info: {
      createdAt: new Date(1000),
      ids: [2n],
    },
    ids: [1n],
  })

  expect(getParent(model.$.info)).toBe(model)
  expect(getParent(model.$.ids)).toBe(model)

  expect(getSnapshot(infoType, model.info)).toEqual({
    createdAt: 1000,
    ids: ["2"],
  })
  expect(getSnapshot(types.array(types.bigint), model.ids)).toEqual(["1"])

  expect(getParent(model.$.info)).toBe(model)
  expect(getParent(model.$.ids)).toBe(model)
})

test("clone preserves codec prop values", () => {
  @testModel("codecProps/clone")
  class M extends Model({
    id: tProp(types.bigint),
    createdAt: tProp(types.dateAsTimestamp),
    ids: tProp(types.array(types.bigint), () => []),
    totals: tProp(types.mapFromObject(types.bigint), () => new Map()),
  }) {}

  const model = new M({
    id: 1n,
    createdAt: new Date(1000),
    ids: [2n, 3n],
    totals: new Map([["a", 4n]]),
  })

  const cloned = clone(model)

  expect(cloned).not.toBe(model)
  expect(cloned.id).toBe(1n)
  expect(+cloned.createdAt).toBe(1000)
  expect(Array.from(cloned.ids)).toEqual([2n, 3n])
  expect(cloned.totals.get("a")).toBe(4n)
  expect(getSnapshot(cloned)).toEqual(getSnapshot(model))
})

test("codec Map proxy methods work correctly", () => {
  @testModel("codecProps/mapProxy")
  class M extends Model({
    objMap: tProp(types.mapFromObject(types.bigint), () => new Map()),
    arrMap: tProp(types.mapFromArray(types.dateAsIsoString, types.bigint), () => new Map()),
  }) {}

  const model = new M({
    objMap: new Map([
      ["a", 1n],
      ["b", 2n],
      ["c", 3n],
    ]),
    arrMap: new Map([
      [new Date("2026-01-01T00:00:00.000Z"), 10n],
      [new Date("2026-01-02T00:00:00.000Z"), 20n],
    ]),
  })

  // size
  expect(model.objMap.size).toBe(3)
  expect(model.arrMap.size).toBe(2)

  // has
  expect(model.objMap.has("a")).toBe(true)
  expect(model.objMap.has("z")).toBe(false)
  expect(model.arrMap.has(new Date("2026-01-01T00:00:00.000Z"))).toBe(true)

  // forEach
  const forEachEntries: Array<[string, bigint]> = []
  model.objMap.forEach((value, key, map) => {
    expect(map).toBe(model.objMap) // 3rd arg is the proxy itself
    forEachEntries.push([key, value])
  })
  expect(forEachEntries).toEqual([
    ["a", 1n],
    ["b", 2n],
    ["c", 3n],
  ])

  // keys
  expect(Array.from(model.objMap.keys())).toEqual(["a", "b", "c"])

  // values
  expect(Array.from(model.objMap.values())).toEqual([1n, 2n, 3n])

  // entries
  expect(Array.from(model.objMap.entries())).toEqual([
    ["a", 1n],
    ["b", 2n],
    ["c", 3n],
  ])

  // Symbol.iterator
  expect(Array.from(model.objMap)).toEqual([
    ["a", 1n],
    ["b", 2n],
    ["c", 3n],
  ])

  // delete
  runUnprotected(() => {
    expect(model.objMap.delete("b")).toBe(true)
    expect(model.objMap.delete("z")).toBe(false)
  })
  expect(model.objMap.size).toBe(2)
  expect(model.objMap.has("b")).toBe(false)

  // clear
  runUnprotected(() => {
    model.objMap.clear()
  })
  expect(model.objMap.size).toBe(0)

  // arrMap forEach with codec keys
  const arrMapEntries: Array<[string, bigint]> = []
  model.arrMap.forEach((value, key) => {
    arrMapEntries.push([key.toISOString(), value])
  })
  expect(arrMapEntries).toEqual([
    ["2026-01-01T00:00:00.000Z", 10n],
    ["2026-01-02T00:00:00.000Z", 20n],
  ])

  // arrMap keys/values
  expect(Array.from(model.arrMap.keys()).map((k) => k.toISOString())).toEqual([
    "2026-01-01T00:00:00.000Z",
    "2026-01-02T00:00:00.000Z",
  ])
  expect(Array.from(model.arrMap.values())).toEqual([10n, 20n])
})

test("codec Set proxy methods work correctly", () => {
  @testModel("codecProps/setProxy")
  class M extends Model({
    numbers: tProp(types.setFromArray(types.number), () => new Set<number>()),
  }) {}

  const model = new M({
    numbers: new Set([1, 2, 3]),
  })

  // size
  expect(model.numbers.size).toBe(3)

  // has
  expect(model.numbers.has(1)).toBe(true)
  expect(model.numbers.has(99)).toBe(false)

  // forEach
  const forEachValues: number[] = []
  model.numbers.forEach((value, key, set) => {
    expect(key).toBe(value) // Set forEach passes value as both key and value
    expect(set).toBe(model.numbers) // 3rd arg is the proxy itself
    forEachValues.push(value)
  })
  expect(forEachValues).toEqual([1, 2, 3])

  // entries (Set entries return [value, value])
  expect(Array.from(model.numbers.entries())).toEqual([
    [1, 1],
    [2, 2],
    [3, 3],
  ])

  // keys/values
  expect(Array.from(model.numbers.keys())).toEqual([1, 2, 3])
  expect(Array.from(model.numbers.values())).toEqual([1, 2, 3])

  // Symbol.iterator
  expect(Array.from(model.numbers)).toEqual([1, 2, 3])

  // delete
  runUnprotected(() => {
    expect(model.numbers.delete(2)).toBe(true)
    expect(model.numbers.delete(99)).toBe(false)
  })
  expect(model.numbers.size).toBe(2)
  expect(model.numbers.has(2)).toBe(false)

  // add
  runUnprotected(() => {
    model.numbers.add(4)
  })
  expect(model.numbers.has(4)).toBe(true)
  expect(model.numbers.size).toBe(3)

  // clear
  runUnprotected(() => {
    model.numbers.clear()
  })
  expect(model.numbers.size).toBe(0)
})

test("codec Array proxy methods work correctly", () => {
  @testModel("codecProps/arrayProxy")
  class M extends Model({
    ids: tProp(types.array(types.bigint), () => []),
  }) {}

  const model = new M({
    ids: [10n, 20n, 30n, 40n, 50n],
  })

  // at (positive and negative)
  expect(model.ids.at(0)).toBe(10n)
  expect(model.ids.at(-1)).toBe(50n)
  expect(model.ids.at(100)).toBeUndefined()

  // pop
  let popped: bigint | undefined
  runUnprotected(() => {
    popped = model.ids.pop()
  })
  expect(popped).toBe(50n)
  expect(model.ids.length).toBe(4)

  // shift
  let shifted: bigint | undefined
  runUnprotected(() => {
    shifted = model.ids.shift()
  })
  expect(shifted).toBe(10n)
  expect(model.ids.length).toBe(3)
  expect(model.ids[0]).toBe(20n)

  // unshift
  runUnprotected(() => {
    model.ids.unshift(5n, 10n)
  })
  expect(model.ids.length).toBe(5)
  expect(model.ids[0]).toBe(5n)
  expect(model.ids[1]).toBe(10n)

  // includes, indexOf
  expect(model.ids.includes(20n)).toBe(true)
  expect(model.ids.includes(999n)).toBe(false)
  expect(model.ids.indexOf(20n)).toBe(2)

  // filter, map, find, findIndex, every, some
  expect(model.ids.filter((v) => v >= 20n)).toEqual([20n, 30n, 40n])
  expect(model.ids.map((v) => v * 2n)).toEqual([10n, 20n, 40n, 60n, 80n])
  expect(model.ids.find((v) => v > 15n)).toBe(20n)
  expect(model.ids.findIndex((v) => v > 15n)).toBe(2)
  expect(model.ids.every((v) => v > 0n)).toBe(true)
  expect(model.ids.some((v) => v > 35n)).toBe(true)

  // slice
  expect(model.ids.slice(1, 3)).toEqual([10n, 20n])

  // concat
  expect(model.ids.concat([100n])).toEqual([5n, 10n, 20n, 30n, 40n, 100n])

  // entries, keys, values
  expect(Array.from(model.ids.entries())).toEqual([
    [0, 5n],
    [1, 10n],
    [2, 20n],
    [3, 30n],
    [4, 40n],
  ])
  expect(Array.from(model.ids.keys())).toEqual([0, 1, 2, 3, 4])
  expect(Array.from(model.ids.values())).toEqual([5n, 10n, 20n, 30n, 40n])

  // reverse
  runUnprotected(() => {
    model.ids.reverse()
  })
  expect(Array.from(model.ids)).toEqual([40n, 30n, 20n, 10n, 5n])
  expect(Array.from(model.$.ids)).toEqual(["40", "30", "20", "10", "5"])

  // sort
  runUnprotected(() => {
    model.ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  })
  expect(Array.from(model.ids)).toEqual([5n, 10n, 20n, 30n, 40n])
  expect(Array.from(model.$.ids)).toEqual(["5", "10", "20", "30", "40"])

  // fill
  runUnprotected(() => {
    model.ids.fill(99n, 1, 3)
  })
  expect(Array.from(model.ids)).toEqual([5n, 99n, 99n, 30n, 40n])

  // copyWithin
  runUnprotected(() => {
    model.ids.copyWithin(0, 3)
  })
  expect(Array.from(model.ids)).toEqual([30n, 40n, 99n, 30n, 40n])
})

test("codec-backed branch with types.skipCheck - snapshot round-trip works", () => {
  @testModel("skipCheck/codecBackedBranch")
  class M extends Model({
    value: tProp(types.skipCheck(types.bigint)),
    createdAt: tProp(types.skipCheck(types.dateAsTimestamp)),
  }) {}

  // Create with initial runtime values
  const m = new M({ value: 42n, createdAt: new Date(1000) })
  expect(m.value).toBe(42n)
  expect(m.createdAt).toBeInstanceOf(Date)
  expect(+m.createdAt).toBe(1000)

  // Snapshot has encoded values
  const sn = getSnapshot(m)
  expect(sn.value).toBe("42")
  expect(sn.createdAt).toBe(1000)

  // Round-trip through applySnapshot
  const m2 = new M({ value: 0n, createdAt: new Date(0) })
  applySnapshot(m2, sn)
  expect(m2.value).toBe(42n)
  expect(+m2.createdAt).toBe(1000)

  // Clone works
  const m3 = clone(m)
  expect(m3.value).toBe(42n)
  expect(+m3.createdAt).toBe(1000)
})
