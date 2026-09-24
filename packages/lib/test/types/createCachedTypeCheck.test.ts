import { isObservableArray, keys } from "mobx"
import {
  getGlobalConfig,
  Model,
  ModelAutoTypeCheckingMode,
  modelAction,
  objectActions,
  runUnprotected,
  setGlobalConfig,
  TypeCheckError,
  toTreeNode,
  tProp,
  typeCheck,
  types,
} from "../../src"
import { testModel } from "../utils"

test.each(["array", "object", "record"] as const)(
  "cached %s checks retain custom model trails after invalidation",
  (kind) => {
    const itemType = types.refinement(types.number, (value) =>
      value >= 0
        ? null
        : new TypeCheckError({
            path: [],
            expectedTypeName: "positive",
            actualValue: value,
            modelTrail: ["Custom"],
          })
    )
    const type =
      kind === "array"
        ? types.array(itemType)
        : kind === "record"
          ? types.record(itemType)
          : types.object(() => ({ value: itemType }))
    const value = kind === "array" ? toTreeNode([-1]) : toTreeNode({ value: -1 })
    expect(typeCheck(type, value)?.modelTrail).toEqual(["Custom"])
    runUnprotected(() => {
      if (Array.isArray(value) || isObservableArray(value)) value[0] = -2
      else value.value = -2
    })
    expect(typeCheck(type, value)?.modelTrail).toEqual(["Custom"])
  }
)

describe("chunked array checks", () => {
  let itemChecks = 0
  const itemType = types.refinement(types.number, (value) => {
    itemChecks++
    return value >= 0
  })
  const arrayType = types.array(itemType)

  function expectSameAsUncached(array: number[]) {
    // a plain copy is not tweaked, so it is checked without caching
    const expected = typeCheck(arrayType, array.slice())
    const actual = typeCheck(arrayType, array)
    expect(actual?.path).toEqual(expected?.path)
    expect(actual?.actualValue).toBe(expected?.actualValue)
  }

  // places an error at every index, so any chunk out of sync with the array shows
  function expectErrorsAtEveryIndex(array: number[]) {
    for (let i = 0; i < array.length; i++) {
      const value = array[i]
      runUnprotected(() => {
        array[i] = -1
      })
      expect(typeCheck(arrayType, array)?.path).toEqual([i])
      runUnprotected(() => {
        array[i] = value
      })
    }
    expect(typeCheck(arrayType, array)).toBeNull()
  }

  function createRandom() {
    let seed = 1
    return (max: number) => {
      seed = (seed * 16807) % 2147483647
      return seed % max
    }
  }

  test("results follow item and structural changes across chunks", () => {
    const array = toTreeNode<number[]>([])
    const random = createRandom()
    const randomValue = () => (random(40) === 0 ? -1 - random(10) : random(10))

    expectSameAsUncached(array)
    for (let i = 0; i < 2000; i++) {
      runUnprotected(() => {
        const op = random(i < 600 ? 4 : 8)
        if (op <= 1) array.push(randomValue())
        else if (op === 2) array.unshift(randomValue())
        else if (op === 3) array.splice(random(array.length + 1), 0, randomValue(), randomValue())
        else if (array.length === 0) return
        else if (op === 4) array[random(array.length)] = randomValue()
        else if (op === 5) array.splice(random(array.length), 1 + random(3))
        else if (op === 6) array.pop()
        else array.shift()
      })
      expectSameAsUncached(array)
    }
  })

  test("chunks follow bulk splices that span, split and merge them", () => {
    const array = toTreeNode<number[]>([])
    const random = createRandom()
    const values = (count: number) => Array.from({ length: count }, () => random(10))

    for (let i = 0; i < 300; i++) {
      runUnprotected(() => {
        const op = random(i < 50 ? 2 : 6)
        const at = random(array.length + 1)
        if (op === 0) array.splice(at, 0, ...values(random(600)))
        else if (op === 1) array.splice(at, random(50), ...values(random(50)))
        else if (op === 2) array.splice(at, random(400))
        else if (op === 3) array.splice(at, random(300), ...values(random(700)))
        else if (op === 4) array.splice(0, array.length, ...values(random(500)))
        else array.splice(random(3) === 0 ? 0 : at)
      })
      expect(typeCheck(arrayType, array)).toBeNull()
      if (i % 50 === 49) {
        expectErrorsAtEveryIndex(array)
      }
    }
    runUnprotected(() => {
      array.splice(0, array.length, ...values(1000))
    })
    expectErrorsAtEveryIndex(array)
  })

  test("chunks follow type-check rollbacks", () => {
    @testModel("chunkedArrayChecks/Store")
    class Store extends Model({ values: tProp(types.array(types.number), () => []) }) {
      @modelAction
      splice(start: number, deleteCount: number, ...items: unknown[]) {
        this.values.splice(start, deleteCount, ...(items as number[]))
      }
    }

    const previous = getGlobalConfig().modelAutoTypeChecking
    setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
    try {
      const store = new Store({ values: Array.from({ length: 1000 }, (_, i) => i) })
      expect(store.typeCheck()).toBeNull()

      expect(() => store.splice(100, 300, 1, "x", 2)).toThrow()
      expect(() => store.splice(0, 0, ...Array.from({ length: 500 }, () => 0), "x")).toThrow()
      expect(store.values.slice()).toEqual(Array.from({ length: 1000 }, (_, i) => i))
      expect(store.typeCheck()).toBeNull()

      store.splice(900, 0, 1, 2, 3)
      expect(() => store.splice(950, 1, "x")).toThrow()
      expect(store.values.length).toBe(1003)
      expect(store.typeCheck()).toBeNull()

      // the error index comes from the chunks
      expect(() =>
        runUnprotected(() => {
          ;(store.values as unknown[])[990] = "y"
        })
      ).toThrow("Path: /values/990")
      expect(store.typeCheck()).toBeNull()
    } finally {
      setGlobalConfig({ modelAutoTypeChecking: previous })
    }
  })

  test("the first error wins across chunks", () => {
    const array = toTreeNode(Array.from({ length: 1000 }, () => 0))
    expect(typeCheck(arrayType, array)).toBeNull()

    runUnprotected(() => {
      array[900] = -1
    })
    expect(typeCheck(arrayType, array)?.path).toEqual([900])

    runUnprotected(() => {
      array[300] = -1
    })
    expect(typeCheck(arrayType, array)?.path).toEqual([300])

    runUnprotected(() => {
      array[300] = 0
    })
    expect(typeCheck(arrayType, array)?.path).toEqual([900])

    runUnprotected(() => {
      array.splice(0, 200)
    })
    expect(typeCheck(arrayType, array)?.path).toEqual([700])
  })

  test("changes only re-check the affected chunks", () => {
    const array = toTreeNode(Array.from({ length: 1000 }, () => 0))
    expect(typeCheck(arrayType, array)).toBeNull()

    itemChecks = 0
    runUnprotected(() => {
      array[500] = 1
    })
    expect(typeCheck(arrayType, array)).toBeNull()
    expect(itemChecks).toBeLessThanOrEqual(128)

    itemChecks = 0
    runUnprotected(() => {
      array.push(1)
    })
    expect(typeCheck(arrayType, array)).toBeNull()
    expect(itemChecks).toBeLessThanOrEqual(128)
  })

  test("nested item errors are found in later chunks", () => {
    const objectArrayType = types.array(types.object(() => ({ value: itemType })))
    const array = toTreeNode(Array.from({ length: 1000 }, () => ({ value: 0 })))
    expect(typeCheck(objectArrayType, array)).toBeNull()

    runUnprotected(() => {
      array[700].value = -1
    })
    const error = typeCheck(objectArrayType, array)
    expect(error?.path).toEqual([700, "value"])
    expect(error?.typeCheckedValue).toBe(array)

    runUnprotected(() => {
      array[700].value = 1
    })
    expect(typeCheck(objectArrayType, array)).toBeNull()
  })
})

describe("chunked record checks", () => {
  let valueChecks = 0
  const valueType = types.refinement(types.number, (value) => {
    valueChecks++
    return value >= 0
  })
  const recordType = types.record(valueType)

  // the first invalid entry in the order the record keys are iterated in, which
  // for MobX 4 is the order they were added in
  function expectFirstError(record: Record<string, number>) {
    const key = keys(record).find((k) => record[k as string] < 0) as string | undefined
    const error = typeCheck(recordType, record)
    expect(error?.path).toEqual(key === undefined ? undefined : [key])
    expect(error?.actualValue).toBe(key === undefined ? undefined : record[key])
  }

  function createRandom() {
    let seed = 1
    return (max: number) => {
      seed = (seed * 16807) % 2147483647
      return seed % max
    }
  }

  test("results follow value and key changes across chunks", () => {
    const record = toTreeNode<Record<string, number>>({})
    const random = createRandom()
    const randomValue = () => (random(40) === 0 ? -1 - random(10) : random(10))
    // integer-like keys are iterated before the others, whatever the order they
    // were added in
    const randomKey = () => (random(3) === 0 ? String(random(600)) : `k${random(600)}`)

    expectFirstError(record)
    for (let i = 0; i < 3000; i++) {
      runUnprotected(() => {
        const op = random(i < 1000 ? 3 : 6)
        const keys = Object.keys(record)
        if (op <= 1 || keys.length === 0) {
          objectActions.set(record, randomKey(), randomValue())
        } else if (op === 2 || op === 3) {
          objectActions.set(record, keys[random(keys.length)], randomValue())
        } else {
          objectActions.delete(record, keys[random(keys.length)])
        }
      })
      expectFirstError(record)
    }
  })

  test("the first error in key order wins across chunks", () => {
    const record = toTreeNode<Record<string, number>>({})
    runUnprotected(() => {
      for (let i = 0; i < 1000; i++) objectActions.set(record, `k${i}`, 0)
    })
    expect(typeCheck(recordType, record)).toBeNull()

    runUnprotected(() => {
      objectActions.set(record, "k900", -1)
    })
    expectFirstError(record)

    runUnprotected(() => {
      objectActions.set(record, "k300", -1)
    })
    expectFirstError(record)

    // added last, but iterated first (except in MobX 4)
    runUnprotected(() => {
      objectActions.set(record, "5", -1)
    })
    expectFirstError(record)

    runUnprotected(() => {
      objectActions.delete(record, "5")
      objectActions.set(record, "k300", 0)
    })
    expectFirstError(record)
  })

  test("changes only re-check the affected entries", () => {
    const record = toTreeNode<Record<string, number>>({})
    runUnprotected(() => {
      for (let i = 0; i < 1000; i++) objectActions.set(record, `k${i}`, 0)
    })
    expect(typeCheck(recordType, record)).toBeNull()

    // the first change of a chunk re-checks it
    valueChecks = 0
    runUnprotected(() => {
      objectActions.set(record, "k500", 1)
    })
    expect(typeCheck(recordType, record)).toBeNull()
    expect(valueChecks).toBeLessThanOrEqual(128)

    // later ones only the changed entry
    valueChecks = 0
    runUnprotected(() => {
      objectActions.set(record, "k500", 2)
    })
    expect(typeCheck(recordType, record)).toBeNull()
    expect(valueChecks).toBe(1)

    // (a key is added to the last chunk, checked again for the first time)
    valueChecks = 0
    runUnprotected(() => {
      objectActions.set(record, "added", 1)
    })
    expect(typeCheck(recordType, record)).toBeNull()
    expect(valueChecks).toBeLessThanOrEqual(128)

    valueChecks = 0
    runUnprotected(() => {
      objectActions.delete(record, "k10")
    })
    expect(typeCheck(recordType, record)).toBeNull()
    expect(valueChecks).toBeLessThanOrEqual(128)
  })

  test("chunks follow type-check rollbacks and checks of the keys", () => {
    @testModel("chunkedRecordChecks/Store")
    class Store extends Model({
      values: tProp(types.record(types.number), () => ({})),
      limited: tProp(
        types.refinement(types.record(types.number), (r) => Object.keys(r).length <= 1000),
        () => ({})
      ),
    }) {
      @modelAction
      set(prop: "values" | "limited", key: string, value: unknown) {
        objectActions.set(this[prop], key, value as number)
      }

      @modelAction
      delete(prop: "values" | "limited", key: string) {
        objectActions.delete(this[prop], key)
      }
    }

    const previous = getGlobalConfig().modelAutoTypeChecking
    setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
    try {
      const initial = () => Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`k${i}`, i]))
      const store = new Store({ values: initial(), limited: initial() })
      expect(store.typeCheck()).toBeNull()

      expect(() => store.set("values", "k5", "x")).toThrow("Path: /values/k5")
      expect(() => store.set("values", "added", "x")).toThrow("Path: /values/added")
      expect({ ...store.values }).toEqual(initial())
      expect(store.typeCheck()).toBeNull()

      store.delete("values", "k5")
      store.set("values", "added", 1)
      expect(() => store.set("values", "k6", "x")).toThrow("Path: /values/k6")
      expect(store.typeCheck()).toBeNull()

      // a refinement of the keys sees the added key right away
      expect(() => store.set("limited", "added", 1)).toThrow("Path: /limited")
      expect(Object.keys(store.limited).length).toBe(1000)
      store.delete("limited", "k0")
      store.set("limited", "added", 1)
      expect(store.typeCheck()).toBeNull()
    } finally {
      setGlobalConfig({ modelAutoTypeChecking: previous })
    }
  })
})

describe("keys added below cached container checks", () => {
  // MobX notifies the added key before invalidating the cached checks that read
  // it while it was missing, so the containers above must not trust them

  let itemChecks = 0
  const itemType = types.refinement(
    types.object(() => ({ a: types.maybe(types.number) })),
    () => {
      itemChecks++
      return true
    }
  )

  @testModel("cachedCheckKeyAdd/Store")
  class Store extends Model({
    array: tProp(types.array(itemType), () => []),
    record: tProp(types.record(itemType), () => ({})),
    nested: tProp(types.array(types.object(() => ({ inner: types.record(itemType) }))), () => []),
  }) {
    @modelAction
    setKey(target: object, key: string, value: unknown) {
      objectActions.set(target as Record<string, unknown>, key, value)
    }
  }

  const createStore = (count: number) =>
    new Store({
      array: Array.from({ length: count }, () => ({})),
      record: Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, {}])),
      nested: Array.from({ length: count }, () => ({ inner: { k: {} } })),
    })

  let previous: ModelAutoTypeCheckingMode
  beforeEach(() => {
    previous = getGlobalConfig().modelAutoTypeChecking
    setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
  })
  afterEach(() => {
    setGlobalConfig({ modelAutoTypeChecking: previous })
  })

  test.each([1, 1000])("invalid keys are rejected in containers of %i items", (count) => {
    const store = createStore(count)
    expect(store.typeCheck()).toBeNull()
    const last = count - 1
    const targets = [
      [store.array[last], `/array/${last}/a`],
      [store.record[`k${last}`], `/record/k${last}/a`],
      [store.nested[last].inner.k, `/nested/${last}/inner/k/a`],
    ] as const

    for (const [target, path] of targets) {
      expect(() => store.setKey(target, "a", "x")).toThrow(`Path: ${path}`)
      expect(target.a).toBeUndefined()
      expect(store.typeCheck()).toBeNull()

      store.setKey(target, "a", 1)
      expect(target.a).toBe(1)
      expect(() => store.setKey(target, "a", "y")).toThrow(`Path: ${path}`)
      expect(store.typeCheck()).toBeNull()
    }
  })

  test("adding a key only re-checks the affected chunk", () => {
    const store = createStore(1000)
    expect(store.typeCheck()).toBeNull()

    for (const target of [store.array[700], store.record.k700, store.nested[700].inner.k]) {
      itemChecks = 0
      store.setKey(target, "a", 1)
      // the chunk of the changed item, checked once while the change is
      // validated and once more when its cached checks are invalidated
      expect(itemChecks).toBeLessThanOrEqual(2 * 128)
      expect(store.typeCheck()).toBeNull()
    }
  })
})
