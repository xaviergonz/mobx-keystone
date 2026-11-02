import { autorun, computed, entries, reaction, remove, runInAction, set } from "mobx"
import {
  applyPatches,
  applySnapshot,
  detach,
  fromSnapshot,
  getSnapshot,
  ObjectMap,
  objectMap,
  runUnprotected,
} from "../../src"
import { getMobxVersion } from "../../src/utils"
import { autoDispose } from "../utils"

let map!: ObjectMap<number>
let obj!: ObjectMap<number>["items"]

beforeEach(() => {
  map = objectMap<number>([
    ["2", 2],
    ["3", 3],
    ["5", 5],
  ])
  obj = map.items
})

function expectMapValues(valsN: number[]) {
  const vals = valsN.map((v) => [String(v), v] as const)
  expect(entries(obj)).toEqual(vals)

  expect([...map.values()]).toEqual(vals.map((v) => v[1]))
  expect([...map.keys()]).toEqual(vals.map((v) => v[0]))
  expect([...map.entries()]).toEqual(vals)
  expect([...map]).toEqual(vals)
  vals.forEach((t) => {
    expect(map.has(t[0])).toBe(true)
  })
  expect(map.size).toBe(vals.length)
}

test("set", () => {
  map.set("3", 300)
  expect(map.get("3")).toBe(300)
  map.set("3", 3)
  expectMapValues([2, 3, 5])

  map.set("12", 12)
  expectMapValues([2, 3, 5, 12])
})

test("clear", () => {
  map.clear()
  expectMapValues([])
})

test("delete", () => {
  expect(map.delete("100")).toBe(false)
  expectMapValues([2, 3, 5])
  expect(map.delete("3")).toBe(true)
  expectMapValues([2, 5])
})

test("forEach", () => {
  const a: [string, number][] = []
  const self = {}
  map.forEach(function (this: any, v, k, m) {
    expect(this).toBe(self)
    a.push([k, v])
    expect(m).toBe(map)
  }, self)
  expect(a).toEqual(Object.entries(obj))
})

test("has", () => {
  expect(map.has("3")).toBe(true)
  expect(map.has("300")).toBe(false)
})

test("reactivity", () => {
  const k = vi.fn()
  autoDispose(reaction(() => [...map.keys()], k))

  const v = vi.fn()
  autoDispose(reaction(() => [...map.values()], v))

  const e = vi.fn()
  autoDispose(reaction(() => [...map.entries()], e))

  const i = vi.fn()
  autoDispose(reaction(() => [...map], i))

  const s = vi.fn()
  autoDispose(reaction(() => map.size, s))

  const h = vi.fn()
  autoDispose(reaction(() => map.has("3"), h))

  expect(k).toHaveBeenCalledTimes(0)
  expect(v).toHaveBeenCalledTimes(0)
  expect(e).toHaveBeenCalledTimes(0)
  expect(i).toHaveBeenCalledTimes(0)
  expect(s).toHaveBeenCalledTimes(0)
  expect(h).toHaveBeenCalledTimes(0)

  // change
  map.set("5", 7)
  expect(k).toHaveBeenCalledTimes(0)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(0)
  expect(h).toHaveBeenCalledTimes(0)
  vi.resetAllMocks()

  // add
  map.set("10", 10)
  expect(k).toHaveBeenCalledTimes(1)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(1)
  expect(h).toHaveBeenCalledTimes(0)
  vi.resetAllMocks()

  // delete
  map.delete("3")
  expect(k).toHaveBeenCalledTimes(1)
  expect(v).toHaveBeenCalledTimes(1)
  expect(e).toHaveBeenCalledTimes(1)
  expect(i).toHaveBeenCalledTimes(1)
  expect(s).toHaveBeenCalledTimes(1)
  expect(h).toHaveBeenCalledTimes(1)
  vi.resetAllMocks()
})

test("detach", () => {
  const map = objectMap<{ x: number }>([
    ["2", { x: 2 }],
    ["3", { x: 3 }],
    ["5", { x: 5 }],
  ])
  detach(map.get("3")!)
  expect(Array.from(map.keys())).toEqual(["2", "5"])
})

test.skipIf(getMobxVersion() === 4)("objectMap preserves an own __proto__ entry", () => {
  const value = { count: 1 }
  const map = objectMap([["__proto__", value]])
  expect(map.has("__proto__")).toBe(true)
  expect(map.get("__proto__")).toEqual(value)
  expect(map.size).toBe(1)
})

test.each([false, true])("getOrInsert returns the stored object (computed=%s)", (computed) => {
  const map = objectMap<{ count: number }>()
  const value = { count: 1 }
  const result = computed
    ? map.getOrInsertComputed("key", () => value)
    : map.getOrInsert("key", value)
  expect(result).toBe(map.get("key"))
})

test("forEach tracks additions and removals in reactions", () => {
  const map = objectMap<number>()
  const observed: number[][] = []
  autoDispose(
    reaction(
      () => {
        const values: number[] = []
        map.forEach((value) => {
          values.push(value)
        })
        return values
      },
      (values) => observed.push(values)
    )
  )
  map.set("a", 1)
  map.set("b", 2)
  map.delete("a")
  map.clear()
  expect(observed).toEqual([[1], [1, 2], [2], []])
})

describe("keys named like Object.prototype properties", () => {
  const inheritedKeys = ["toString", "constructor", "hasOwnProperty", "valueOf", "__proto__"]
  // MobX 4 cannot add observable properties named like inherited ones: its `set` mistakes the
  // inherited value for an existing observable property (and __proto__ cannot be created at all).
  const insertableKeys = getMobxVersion() === 4 ? [] : inheritedKeys

  test.each(inheritedKeys)("%s is not an entry unless set", (key) => {
    const map = objectMap<number>([["a", 1]])
    expect(map.has(key)).toBe(false)
    expect(map.get(key)).toBe(undefined)
    expect(map.delete(key)).toBe(false)
    expect(map.size).toBe(1)
    expect([...map.keys()]).toEqual(["a"])
  })

  test.each(insertableKeys)("%s can be set, read and deleted", (key) => {
    const map = objectMap<number>([["a", 1]])
    map.set(key, 2)
    expect(map.has(key)).toBe(true)
    expect(map.get(key)).toBe(2)
    expect(map.size).toBe(2)
    expect([...map.keys()]).toEqual(["a", key])

    expect(map.delete(key)).toBe(true)
    expect(map.has(key)).toBe(false)
    expect(map.get(key)).toBe(undefined)
    expect(map.delete(key)).toBe(false)
    expect(map.size).toBe(1)
  })

  test.each(insertableKeys)("getOrInsert inserts %s as an entry", (key) => {
    const map = objectMap<number>()
    expect(map.getOrInsert(key, 7)).toBe(7)
    expect(map.has(key)).toBe(true)
    expect(map.getOrInsert(key, 8)).toBe(7)
    expect(map.size).toBe(1)
  })

  test.each(insertableKeys)("getOrInsertComputed inserts %s as an entry", (key) => {
    const map = objectMap<number>()
    const callback = vi.fn((k: string) => k.length)
    expect(map.getOrInsertComputed(key, callback)).toBe(key.length)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(key)
    expect(map.getOrInsertComputed(key, callback)).toBe(key.length)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(map.has(key)).toBe(true)
    expect(map.size).toBe(1)
  })

  test.skipIf(getMobxVersion() === 4)("an own __proto__ entry survives snapshots", () => {
    const map = objectMap<number>()
    map.set("__proto__", 1)
    expect(Object.getPrototypeOf(map.items)).toBe(Object.prototype)
    expect([...map.keys()]).toEqual(["__proto__"])
    expect(map.size).toBe(1)

    const sn = getSnapshot(map)
    expect(Object.hasOwn(sn.items, "__proto__")).toBe(true)
    expect(Reflect.get(sn.items, "__proto__")).toBe(1)

    const copy = fromSnapshot(ObjectMap<number>, sn)
    expect(copy.has("__proto__")).toBe(true)
    expect(copy.get("__proto__")).toBe(1)
    expect([...copy.keys()]).toEqual(["__proto__"])
    expect(Object.getPrototypeOf(copy.items)).toBe(Object.prototype)
  })

  test.each([
    ["items", "__proto__", "polluted"],
    ["items", "constructor", "polluted"],
    ["items", "constructor", "prototype", "polluted"],
  ])("patches through inherited properties do not pollute prototypes (%j)", (...path) => {
    const map = objectMap<number>()
    expect(() => {
      applyPatches(map, [{ op: "add", path, value: 1 }])
    }).toThrow("'set()' can only be used on observable objects")
    expect(Reflect.get({}, "polluted")).toBe(undefined)
    expect(map.size).toBe(0)
  })

  test.skipIf(getMobxVersion() === 4)("an add patch at items.__proto__ stores an entry", () => {
    const map = objectMap<number>()
    applyPatches(map, [{ op: "add", path: ["items", "__proto__"], value: 1 }])
    expect(Object.getPrototypeOf(map.items)).toBe(Object.prototype)
    expect(map.has("__proto__")).toBe(true)
    expect(map.get("__proto__")).toBe(1)
    expect([...map.keys()]).toEqual(["__proto__"])
  })

  test.each([...insertableKeys, "regular"])(
    "has/get observers are notified when %s is added and removed",
    (key) => {
      const map = objectMap<number>()

      const hasValues: boolean[] = []
      autoDispose(
        reaction(
          () => map.has(key),
          (v) => hasValues.push(v)
        )
      )
      const getValues: (number | undefined)[] = []
      autoDispose(
        reaction(
          () => map.get(key),
          (v) => getValues.push(v)
        )
      )
      const hasComputed = computed(() => map.has(key))
      const hasComputedValues: boolean[] = []
      autoDispose(
        reaction(
          () => hasComputed.get(),
          (v) => hasComputedValues.push(v)
        )
      )

      map.set(key, 1)
      map.set(key, 2)
      map.delete(key)
      map.set(key, 3)
      map.clear()

      expect(hasValues).toEqual([true, false, true, false])
      expect(hasComputedValues).toEqual([true, false, true, false])
      expect(getValues).toEqual([1, 2, undefined, 3, undefined])
    }
  )

  test.each(insertableKeys)(
    "has/get observers see %s added and removed outside the map methods",
    (key) => {
      const map = objectMap<number>()
      const hasValues: boolean[] = []
      autoDispose(
        reaction(
          () => map.has(key),
          (v) => hasValues.push(v)
        )
      )
      const getValues: (number | undefined)[] = []
      autoDispose(
        reaction(
          () => map.get(key),
          (v) => getValues.push(v)
        )
      )

      applyPatches(map, [{ op: "add", path: ["items", key], value: 1 }])
      applySnapshot(map, { ...getSnapshot(map), items: {} })
      runUnprotected(() => {
        set(map.items, key, 2)
      })
      runUnprotected(() => {
        remove(map.items, key)
      })

      expect(hasValues).toEqual([true, false, true, false])
      expect(getValues).toEqual([1, undefined, 2, undefined])
    }
  )

  // MobX 4's own `has` subscribes to every key change.
  test.skipIf(getMobxVersion() === 4)(
    "has/get observers of inherited names ignore unrelated keys",
    () => {
      const map = objectMap<number>([["a", 1]])
      map.set("constructor", 1)

      let hasRuns = 0
      autoDispose(
        autorun(() => {
          map.has("toString")
          map.has("constructor")
          hasRuns++
        })
      )
      let getRuns = 0
      autoDispose(
        autorun(() => {
          map.get("toString")
          getRuns++
        })
      )

      map.set("b", 2)
      map.set("a", 3)
      map.delete("b")
      // other inherited names have their own subscriptions
      map.set("valueOf", 1)
      map.delete("valueOf")
      expect(hasRuns).toBe(1)
      expect(getRuns).toBe(1)
    }
  )

  test.each(insertableKeys)(
    "a computed read in an action sees %s being added and removed",
    (key) => {
      const map = objectMap<number>()
      const hasKey = computed(() => map.has(key))
      const value = computed(() => map.get(key))
      runInAction(() => {
        // computeds without observers stay cached until the end of the action
        expect(hasKey.get()).toBe(false)
        expect(value.get()).toBe(undefined)
        map.set(key, 1)
        expect(hasKey.get()).toBe(true)
        expect(value.get()).toBe(1)
        map.delete(key)
        expect(hasKey.get()).toBe(false)
        expect(value.get()).toBe(undefined)
      })
    }
  )
})
