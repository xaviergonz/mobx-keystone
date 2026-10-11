import { observable } from "mobx"
import {
  applyCall,
  builtinSerializers,
  CallErrorCode,
  createSerializer,
  DataModel,
  defaultSerializer,
  frozen,
  getSnapshot,
  idProp,
  isFrozenSnapshot,
  type JsonValue,
  Model,
  model,
  modelAction,
  pathRefs,
  prop,
  tProp,
  types,
  type ValueSerializer,
} from "../../src"
import { builtinEncodedTypeof } from "../../src/serialization/builtinSerializers"
import { catchCallError } from "./utils"

@model("serialization/serializers/Point")
class Point extends Model({ x: prop<number>(), y: prop<number>() }, { valueType: true }) {
  @modelAction
  moveBy(dx: number) {
    this.x += dx
  }
}

@model("serialization/serializers/Card")
class Card extends Model({ id: idProp, title: prop("") }) {}

@model("serialization/serializers/Size")
class Size extends DataModel({ w: prop<number>(), h: prop<number>() }) {
  get area() {
    return this.w * this.h
  }
}

@model("serialization/serializers/Label")
class Label extends DataModel({ a: tProp(types.string) }) {}

@model("serialization/serializers/Board")
class Board extends Model({
  cards: prop<Card[]>(() => []),
  origin: prop<Point>(() => new Point({ x: 0, y: 0 })),
  meta: prop<{ a: number }>(() => ({ a: 1 })),
  size: prop<{ w: number; h: number }>(() => ({ w: 2, h: 3 })),
  data: prop(() => frozen<unknown>(null)),
}) {}

function createBoard() {
  return new Board({
    cards: [new Card({ id: "c1", title: "one" }), new Card({ id: "c2", title: "two" })],
  })
}

function roundTrip(root: object, value: unknown, serializer = defaultSerializer) {
  const json = serializer.encodeValue(root, value)
  // must survive JSON
  const parsed = JSON.parse(JSON.stringify(json)) as JsonValue
  return { json, back: serializer.decodeValue(root, parsed) }
}

describe("built-ins", () => {
  let root: Board
  beforeEach(() => {
    root = createBoard()
  })

  test("plain JSON goes as is", () => {
    const value = { a: 1, b: "x", c: [true, null, { d: 2 }] }
    const { json, back } = roundTrip(root, value)
    expect(json).toEqual(value)
    expect(back).toEqual(value)
  })

  test("bigints", () => {
    for (const n of [0n, -5n, 2n ** 80n, -(2n ** 80n)]) {
      const { json, back } = roundTrip(root, n)
      expect(json).toEqual({ $mobxKeystone: "bigint", v: n.toString() })
      expect(back).toBe(n)
    }
  })

  test("non-finite numbers", () => {
    expect(roundTrip(root, Number.NaN).back).toBeNaN()
    expect(roundTrip(root, Infinity).back).toBe(Infinity)
    expect(roundTrip(root, -Infinity).back).toBe(-Infinity)
    expect(defaultSerializer.encodeValue(root, -Infinity)).toEqual({
      $mobxKeystone: "number",
      v: "-Infinity",
    })
  })

  test("dates", () => {
    for (const date of [
      new Date(2020, 1, 2),
      new Date("-001000-01-01T00:00:00.000Z"),
      new Date("+012000-01-01T00:00:00.000Z"),
    ]) {
      const { json, back } = roundTrip(root, date)
      expect(json).toEqual({ $mobxKeystone: "date", v: date.toISOString() })
      expect((back as Date).getTime()).toBe(date.getTime())
    }

    const invalid = roundTrip(root, new Date(Number.NaN))
    expect(invalid.json).toEqual({ $mobxKeystone: "date", v: null })
    expect((invalid.back as Date).getTime()).toBeNaN()
  })

  test("dates decode from a string, a timestamp and null", () => {
    const decode = (v: JsonValue) =>
      defaultSerializer.decodeValue(root, { $mobxKeystone: "date", v }) as Date
    expect(decode("2020-01-02T03:04:05.000Z").getTime()).toBe(Date.UTC(2020, 0, 2, 3, 4, 5))
    expect(decode(1000).getTime()).toBe(1000)
    expect(decode(null).getTime()).toBeNaN()

    for (const v of ["not a date", 1e20]) {
      expect(catchCallError(() => decode(v)).code).toBe(CallErrorCode.BadArgument)
    }
  })

  test("undefined, in arrays and as properties (keeping the key)", () => {
    const { json, back } = roundTrip(root, { a: undefined, b: [undefined, 1] })
    expect(json).toEqual({
      a: { $mobxKeystone: "undefined" },
      b: [{ $mobxKeystone: "undefined" }, 1],
    })
    expect(back).toStrictEqual({ a: undefined, b: [undefined, 1] })
    expect(Object.keys(back as object)).toEqual(["a", "b"])
  })

  test("nested maps and sets, with model keys", () => {
    const card = root.cards[0]
    const value = { list: [new Map<unknown, unknown>([[card, new Set([1, 2n])]])] }
    const { back } = roundTrip(root, value)
    const map = (back as typeof value).list[0]
    expect(map).toBeInstanceOf(Map)
    const [[key, set]] = Array.from(map.entries()) as [unknown, Set<unknown>][]
    expect(key).toBe(card)
    expect(set).toEqual(new Set([1, 2n]))
  })

  test("models outside the tree go as snapshots and come back as new instances", () => {
    const detached = new Card({ id: "c1", title: "copy" })
    const { json, back } = roundTrip(root, detached)
    expect(json).toEqual(getSnapshot(detached))
    expect(back).toBeInstanceOf(Card)
    expect(back).not.toBe(detached)
    expect(back).not.toBe(root.cards[0])
    expect(getSnapshot(back as Card)).toEqual(getSnapshot(detached))
  })

  test("frozen data holding markers comes back unchanged", () => {
    const inner = { $mobxKeystone: "pathRef", v: { path: [] }, $modelType: "nope" }
    const f = frozen(inner)
    const { json, back } = roundTrip(root, f)
    expect(isFrozenSnapshot(json)).toBe(true)
    expect((back as typeof f).data).toEqual(inner)
  })

  test("plain objects with reserved keys survive escaping", () => {
    for (const value of [
      { $mobxKeystone: "date", v: 5 },
      { $modelType: "x", a: 1 },
      { $frozen: true, data: 1 },
    ]) {
      const { json, back } = roundTrip(root, value)
      expect(json).toEqual({ $mobxKeystone: "object", v: value })
      expect(back).toEqual(value)
    }
  })

  test("__proto__ keys are kept as own data", () => {
    const value = JSON.parse('{"__proto__": {"polluted": 1}}')
    const { back } = roundTrip(root, value)
    expect(Object.getPrototypeOf(back)).toBe(Object.prototype)
    expect(Object.keys(back as object)).toEqual(["__proto__"])
    expect(({} as any).polluted).toBeUndefined()
  })

  test("observable values outside a tree encode like plain ones", () => {
    const value = observable({
      arr: [1, 2],
      obj: { a: 1 },
      map: new Map([["k", 1]]),
      set: new Set([1]),
    })
    const { json, back } = roundTrip(root, value)
    expect(json).toEqual({
      arr: [1, 2],
      obj: { a: 1 },
      map: { $mobxKeystone: "map", v: [["k", 1]] },
      set: { $mobxKeystone: "set", v: [1] },
    })
    expect(back).toEqual({
      arr: [1, 2],
      obj: { a: 1 },
      map: new Map([["k", 1]]),
      set: new Set([1]),
    })
  })

  test("functions, symbols, class instances and errors cannot be encoded", () => {
    class Foo {}
    for (const value of [() => {}, Symbol("s"), new Foo(), new Error("e")]) {
      const err = catchCallError(() => defaultSerializer.encodeValue(root, { a: [value] }))
      expect(err.code).toBe(CallErrorCode.CannotEncode)
      expect(err.path).toEqual(["a", 0])
    }
  })

  test("a cycle fails with the path where it closes", () => {
    const value: any = { a: { b: [] } }
    value.a.b.push(value)
    const err = catchCallError(() => defaultSerializer.encodeValue(root, value))
    expect(err.code).toBe(CallErrorCode.CannotEncode)
    expect(err.path).toEqual(["a", "b", 0])
  })

  test("a value shared without a cycle is fine", () => {
    const shared = { x: 1 }
    expect(defaultSerializer.encodeValue(root, [shared, shared])).toEqual([{ x: 1 }, { x: 1 }])
  })

  test("invalid JSON is BadArgument, with the path of the value", () => {
    const invalid: unknown[] = [
      { $mobxKeystone: "bigint", v: "1.5" },
      { $mobxKeystone: "nope" },
      { $mobxKeystone: 5 },
      { $mobxKeystone: "object", v: [] },
      { $mobxKeystone: "date", v: true },
      { $mobxKeystone: "map", v: {} },
      { $mobxKeystone: "map", v: [[1]] },
      { $mobxKeystone: "set", v: {} },
      { $mobxKeystone: "number", v: "5" },
      undefined,
      () => {},
    ]
    for (const value of invalid) {
      const err = catchCallError(() =>
        defaultSerializer.decodeValue(root, { a: [1, value] } as JsonValue)
      )
      expect({ value, code: err.code, path: err.path }).toEqual({
        value,
        code: CallErrorCode.BadArgument,
        path: ["a", 1],
      })
    }
  })

  test("snapshots that fail to decode are BadArgument, with the error as cause", () => {
    const err = catchCallError(() =>
      defaultSerializer.decodeValue(root, [{ $modelType: "serialization/serializers/Nope" }])
    )
    expect(err.code).toBe(CallErrorCode.BadArgument)
    expect(err.path).toEqual([0])
    expect(err.cause).toBeInstanceOf(Error)
  })

  test("toJSON of CannotEncode leaves the value out", () => {
    class Secret {
      password = "hunter2"
    }
    const err = catchCallError(() => defaultSerializer.encodeValue(root, { s: new Secret() }))
    expect(err.message).toContain("hunter2")
    const json = err.toJSON()
    expect(json.code).toBe(CallErrorCode.CannotEncode)
    expect(json.path).toEqual(["s"])
    expect(JSON.stringify(json)).not.toContain("hunter2")
  })

  test("toJSON leaves the cause's message out", () => {
    const decodeLabel = (data: JsonValue) =>
      defaultSerializer.decodeValue(root, {
        $mobxKeystone: "dataModel",
        v: { type: "serialization/serializers/Label", data },
      })
    expect((decodeLabel({ a: "x" }) as Label).a).toBe("x")

    // over data of the tree that fails its type check: the cause shows that data
    const err = catchCallError(() =>
      decodeLabel({ $mobxKeystone: "pathRef", v: { path: ["meta"] } })
    )
    expect(err.code).toBe(CallErrorCode.BadArgument)
    expect(err.cause).toBeInstanceOf(Error)
    expect(err.message).toContain((err.cause as Error).message)
    expect(err.toJSON().message).not.toContain((err.cause as Error).message)
    expect(err.toJSON().message).toContain("the 'dataModel' serializer failed to decode the value")
  })

  test("every built-in says which typeof it encodes", () => {
    for (const serializer of Object.values(builtinSerializers)) {
      expect(builtinEncodedTypeof.has(serializer)).toBe(true)
    }
  })

  test("builtinSerializers holds them in order", () => {
    expect(Object.values(builtinSerializers).map((s) => s.tag)).toEqual([
      "snapshot",
      "dataModel",
      "date",
      "map",
      "set",
      "number",
      "bigint",
      "undefined",
    ])
  })
})

describe("data models", () => {
  test("over data of the tree, they come back over the same node", () => {
    const root = createBoard()
    const { json, back } = roundTrip(root, new Size(root.size))
    expect(json).toEqual({
      $mobxKeystone: "dataModel",
      v: {
        type: "serialization/serializers/Size",
        data: { $mobxKeystone: "pathRef", v: { path: ["size"], ids: [null] } },
      },
    })
    expect(back).toBeInstanceOf(Size)
    expect((back as Size).$).toBe(root.size)
    expect((back as Size).area).toBe(6)
  })

  test("over other data, they come back over a copy", () => {
    const root = createBoard()
    const { json, back } = roundTrip(root, new Size({ w: 4, h: 5 }))
    expect(json).toEqual({
      $mobxKeystone: "dataModel",
      v: { type: "serialization/serializers/Size", data: { w: 4, h: 5 } },
    })
    expect(back).toBeInstanceOf(Size)
    expect((back as Size).area).toBe(20)
  })

  test("unknown types, types that are not data models and invalid payloads fail", () => {
    const root = createBoard()
    const payloads: JsonValue[] = [
      { type: "serialization/serializers/Nope", data: {} },
      { type: "serialization/serializers/Card", data: {} },
      { data: {} },
    ]
    for (const v of payloads) {
      expect(
        catchCallError(() => defaultSerializer.decodeValue(root, { $mobxKeystone: "dataModel", v }))
          .code
      ).toBe(CallErrorCode.BadArgument)
    }
  })
})

describe("value-type models", () => {
  test("go as snapshots by default, even in the tree", () => {
    const root = createBoard()
    const json = defaultSerializer.encodeValue(root, root.origin)
    expect(json).toEqual(getSnapshot(root.origin))
  })

  test("go as references through when", () => {
    const root = createBoard()
    const serializer = createSerializer({ serializers: [pathRefs({ when: () => true })] })
    const json = serializer.encodeValue(root, root.origin)
    expect(json).toEqual({
      $mobxKeystone: "pathRef",
      v: { path: ["origin"], ids: [null] },
    })
    expect(serializer.decodeValue(root, json)).toBe(root.origin)
  })

  test("go as a reference when they are the target", () => {
    const root = createBoard()
    const json = defaultSerializer.encodeCall(root, {
      target: root.origin,
      name: "moveBy",
      args: [2],
    })
    expect(json.target).toEqual({ $mobxKeystone: "pathRef", v: { path: ["origin"], ids: [null] } })
    const call = defaultSerializer.decodeCall(root, json)
    expect(call.target).toBe(root.origin)
    applyCall(root, call)
    expect(root.origin.x).toBe(2)
  })
})

describe("createSerializer", () => {
  const polygonTag = "test/Polygon"
  class Polygon {
    readonly points: number[]

    constructor(points: number[]) {
      this.points = points
    }
  }
  const polygonSerializer: ValueSerializer<Polygon, JsonValue[]> = {
    tag: polygonTag,
    is: (v): v is Polygon => v instanceof Polygon,
    encode: (v, ctx) => v.points.map((p, i) => ctx.encode(p, i)),
    decode: (json, ctx) => new Polygon(json.map((p, i) => ctx.decode(p, i) as number)),
  }

  test("custom serializers nest", () => {
    const root = createBoard()
    const serializer = createSerializer({
      serializers: [...defaultSerializer.serializers, polygonSerializer],
    })
    const { json, back } = roundTrip(root, { p: new Polygon([1, Infinity]) }, serializer)
    expect(json).toEqual({
      p: { $mobxKeystone: polygonTag, v: [1, { $mobxKeystone: "number", v: "Infinity" }] },
    })
    expect((back as any).p).toBeInstanceOf(Polygon)
    expect((back as any).p.points).toEqual([1, Infinity])
  })

  test("custom serializers can claim primitives and plain objects", () => {
    const root = createBoard()
    const upper: ValueSerializer<string, string> = {
      tag: "test/upper",
      is: (v): v is string => typeof v === "string" && v.startsWith("!"),
      encode: (v) => v.slice(1).toUpperCase(),
      decode: (json) => `!${json.toLowerCase()}`,
    }
    const pair: ValueSerializer<{ l: number; r: number }, [number, number]> = {
      tag: "test/pair",
      is: (v): v is { l: number; r: number } =>
        typeof v === "object" && v !== null && "l" in v && "r" in v,
      encode: (v) => [v.l, v.r],
      decode: ([l, r]) => ({ l, r }),
    }
    const serializer = createSerializer({ serializers: [upper, pair] })
    const value = { s: "!hi", p: { l: 1, r: 2 }, arr: ["!x", "y"] }
    const { json, back } = roundTrip(root, value, serializer)
    expect(json).toEqual({
      s: { $mobxKeystone: "test/upper", v: "HI" },
      p: { $mobxKeystone: "test/pair", v: [1, 2] },
      arr: [{ $mobxKeystone: "test/upper", v: "X" }, "y"],
    })
    expect(back).toEqual(value)
  })

  test("a custom serializer can shadow a built-in", () => {
    const root = createBoard()
    const dateAsNumber: ValueSerializer<Date, number> = {
      tag: "test/dateAsNumber",
      is: (v): v is Date => v instanceof Date,
      encode: (v) => v.getTime(),
      decode: (json) => new Date(json),
    }
    const serializer = createSerializer({ serializers: [dateAsNumber] })
    expect(serializer.encodeValue(root, new Date(5))).toEqual({
      $mobxKeystone: "test/dateAsNumber",
      v: 5,
    })
    // the built-in still decodes its own tag
    expect(serializer.decodeValue(root, { $mobxKeystone: "date", v: 5 })).toEqual(new Date(5))
  })

  test("builtins: false refuses anything unknown", () => {
    const root = createBoard()
    const strict = createSerializer({ serializers: [builtinSerializers.date], builtins: false })
    expect(strict.encodeValue(root, new Date(0))).toEqual({
      $mobxKeystone: "date",
      v: new Date(0).toISOString(),
    })
    expect(catchCallError(() => strict.encodeValue(root, 1n)).code).toBe(CallErrorCode.CannotEncode)
    expect(catchCallError(() => strict.encodeValue(root, [undefined])).code).toBe(
      CallErrorCode.CannotEncode
    )
    expect(catchCallError(() => strict.encodeValue(root, root.cards[0])).code).toBe(
      CallErrorCode.CannotEncode
    )
    // snapshots are plain objects to it
    expect(strict.decodeValue(root, { $modelType: "x" })).toEqual({ $modelType: "x" })
    expect(
      catchCallError(() => strict.decodeValue(root, { $mobxKeystone: "bigint", v: "1" })).code
    ).toBe(CallErrorCode.BadArgument)
  })

  test("a built-in passed explicitly isn't added twice", () => {
    const serializer = createSerializer({ serializers: [builtinSerializers.bigint] })
    expect(serializer.serializers).toEqual([builtinSerializers.bigint])
  })

  test("errors thrown by a serializer are wrapped once, with the cause", () => {
    const root = createBoard()
    const cause = new Error("boom")
    const failing: ValueSerializer<Polygon, null> = {
      tag: "test/failing",
      is: (v): v is Polygon => v instanceof Polygon,
      encode: () => {
        throw cause
      },
      decode: () => {
        throw cause
      },
    }
    const serializer = createSerializer({ serializers: [failing] })

    const encodeErr = catchCallError(() => serializer.encodeValue(root, [new Polygon([])]))
    expect(encodeErr.code).toBe(CallErrorCode.CannotEncode)
    expect(encodeErr.cause).toBe(cause)
    expect(encodeErr.path).toEqual([0])

    const decodeErr = catchCallError(() =>
      serializer.decodeValue(root, { a: { $mobxKeystone: "test/failing", v: null } })
    )
    expect(decodeErr.code).toBe(CallErrorCode.BadArgument)
    expect(decodeErr.cause).toBe(cause)
    expect(decodeErr.path).toEqual(["a"])

    const throwingIs = createSerializer({
      serializers: [
        {
          ...failing,
          is: (_v: unknown): _v is Polygon => {
            throw cause
          },
        },
      ],
    })
    const isErr = catchCallError(() => throwingIs.encodeValue(root, 1))
    expect(isErr.code).toBe(CallErrorCode.CannotEncode)
    expect(isErr.cause).toBe(cause)
  })

  test("a CallError thrown by a nested value passes through as it is", () => {
    const root = createBoard()
    const serializer = createSerializer({ serializers: [polygonSerializer] })
    const err = catchCallError(() =>
      serializer.decodeValue(root, {
        $mobxKeystone: polygonTag,
        v: [1, { $mobxKeystone: "bigint", v: "x" }],
      })
    )
    expect(err.message).toContain("invalid 'bigint' value")
    expect(err.path).toEqual([1])
    expect(err.cause).toBeUndefined()
  })

  test("validation", () => {
    expect(() => createSerializer({ serializers: [{ tag: "object" } as any] })).toThrow(
      "must be a value serializer"
    )
    expect(() =>
      createSerializer({ serializers: [{ ...polygonSerializer, tag: "object" }] })
    ).toThrow("the tag 'object' is reserved")
    expect(() =>
      createSerializer({ serializers: [polygonSerializer, { ...polygonSerializer }] })
    ).toThrow(`there is more than one serializer with tag '${polygonTag}'`)
    expect(() =>
      createSerializer({ serializers: [{ ...polygonSerializer, tag: "date" }] })
    ).toThrow("there is more than one serializer with tag 'date'")
    expect(() => createSerializer({ serializers: [defaultSerializer as any] })).toThrow(
      "spread its '.serializers'"
    )
  })

  test("root must be a tree root", () => {
    const root = createBoard()
    expect(() => defaultSerializer.encodeValue(root.cards, 1)).toThrow("root must be a tree root")
    expect(() => defaultSerializer.decodeValue({}, 1)).toThrow("root must be a tree root")
  })
})
