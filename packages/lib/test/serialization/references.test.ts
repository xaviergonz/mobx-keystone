import {
  CallErrorCode,
  createSerializer,
  defaultSerializer,
  getSnapshot,
  idProp,
  idRefs,
  type JsonValue,
  Model,
  model,
  pathRefs,
  prop,
} from "../../src"
import { catchCallError } from "./utils"

@model("serialization/references/Point")
class Point extends Model({ x: prop(0), y: prop(0) }, { valueType: true }) {}

@model("serialization/references/Card")
class Card extends Model({ id: idProp, title: prop("") }) {}

@model("serialization/references/Note")
class Note extends Model({ text: prop("") }) {}

@model("serialization/references/Board")
class Board extends Model({
  id: idProp,
  cards: prop<Card[]>(() => []),
  notes: prop<Note[]>(() => []),
  origin: prop(() => new Point({})),
  meta: prop<{ tags: string[] }>(() => ({ tags: ["a"] })),
}) {}

function createBoard() {
  return new Board({
    id: "b1",
    cards: [new Card({ id: "c1", title: "one" }), new Card({ id: "c2", title: "two" })],
    notes: [new Note({ text: "n1" })],
  })
}

describe("pathRefs", () => {
  test("references any node of the tree, checking ids", () => {
    const root = createBoard()
    const json = defaultSerializer.encodeValue(root, {
      card: root.cards[1],
      cards: root.cards,
      meta: root.meta,
      tags: root.meta.tags,
    })
    expect(json).toEqual({
      card: { $mobxKeystone: "pathRef", v: { path: ["cards", 1], ids: [null, "c2"] } },
      cards: { $mobxKeystone: "pathRef", v: { path: ["cards"], ids: [null] } },
      meta: { $mobxKeystone: "pathRef", v: { path: ["meta"], ids: [null] } },
      tags: { $mobxKeystone: "pathRef", v: { path: ["meta", "tags"], ids: [null, null] } },
    })

    const back = defaultSerializer.decodeValue(root, json) as any
    expect(back.card).toBe(root.cards[1])
    expect(back.cards).toBe(root.cards)
    expect(back.meta).toBe(root.meta)
    expect(back.tags).toBe(root.meta.tags)
  })

  test("the root itself", () => {
    const root = createBoard()
    const json = defaultSerializer.encodeValue(root, root)
    expect(json).toEqual({ $mobxKeystone: "pathRef", v: { path: [], ids: [] } })
    expect(defaultSerializer.decodeValue(root, json)).toBe(root)
  })

  test("ids are optional when decoding", () => {
    const root = createBoard()
    expect(
      defaultSerializer.decodeValue(root, { $mobxKeystone: "pathRef", v: { path: ["cards", 0] } })
    ).toBe(root.cards[0])
  })

  test("a wrong id fails with NotFound", () => {
    const root = createBoard()
    const err = catchCallError(() =>
      defaultSerializer.decodeValue(root, {
        arg: { $mobxKeystone: "pathRef", v: { path: ["cards", 0], ids: [null, "c2"] } },
      })
    )
    expect(err.code).toBe(CallErrorCode.NotFound)
    expect(err.path).toEqual(["arg"])
    expect(err.message).toContain(
      `object at path ["cards",0] with ids [null,"c2"] could not be resolved`
    )
  })

  test("untrusted paths: length, __proto__, constructor and out of bounds never resolve", () => {
    const root = createBoard()
    for (const path of [
      ["cards", "length"],
      ["__proto__"],
      ["constructor"],
      ["cards", "__proto__"],
      ["meta", "constructor"],
      ["cards", 5],
      ["cards", -1],
      ["title"],
      ["cards", 0, "title"],
    ]) {
      const err = catchCallError(() =>
        defaultSerializer.decodeValue(root, { $mobxKeystone: "pathRef", v: { path } })
      )
      expect(err.code).toBe(CallErrorCode.NotFound)
    }
  })

  test("invalid payloads are BadArgument", () => {
    const root = createBoard()
    for (const v of [
      null,
      {},
      { path: "cards" },
      { path: [{}] },
      { path: [], ids: [1] },
    ] as JsonValue[]) {
      const err = catchCallError(() =>
        defaultSerializer.decodeValue(root, { $mobxKeystone: "pathRef", v })
      )
      expect(err.code).toBe(CallErrorCode.BadArgument)
    }
  })

  test("nodes of another tree and detached nodes fall through to snapshots", () => {
    const root = createBoard()
    const other = createBoard()
    const detached = new Card({ id: "c9" })
    expect(defaultSerializer.encodeValue(root, other.cards[0])).toEqual(getSnapshot(other.cards[0]))
    expect(defaultSerializer.encodeValue(root, detached)).toEqual(getSnapshot(detached))
  })

  test("arrays and plain objects of another tree are walked, escaping reserved keys", () => {
    const root = createBoard()
    const other = new Board({ meta: { tags: ["x"], $mobxKeystone: "date" } as any })
    const json = defaultSerializer.encodeValue(root, other.meta)
    expect(json).toEqual({ $mobxKeystone: "object", v: { tags: ["x"], $mobxKeystone: "date" } })
    expect(defaultSerializer.decodeValue(root, json)).toEqual({
      tags: ["x"],
      $mobxKeystone: "date",
    })
  })

  test("a models-only when walks arrays and plain objects", () => {
    const root = createBoard()
    const serializer = createSerializer({
      serializers: [
        pathRefs({ when: (_node, { isModel, isValueType }) => isModel && !isValueType }),
      ],
    })
    const json = serializer.encodeValue(root, root.notes)
    expect(json).toEqual([
      { $mobxKeystone: "pathRef", v: { path: ["notes", 0], ids: [null, null] } },
    ])
    const back = serializer.decodeValue(root, json) as Note[]
    expect(back).not.toBe(root.notes)
    expect(back[0]).toBe(root.notes[0])

    expect(serializer.encodeValue(root, root.meta)).toEqual({ tags: ["a"] })
    expect(serializer.encodeValue(root, root.origin)).toEqual(getSnapshot(root.origin))
  })

  test("when gets the node and whether it is a (value-type) model", () => {
    const root = createBoard()
    const calls: [unknown, unknown][] = []
    const serializer = createSerializer({
      serializers: [
        pathRefs({
          when: (node, info) => {
            calls.push([node, info])
            return true
          },
        }),
      ],
    })
    serializer.encodeValue(root, [root.origin, root.cards[0], root.cards])
    expect(calls).toEqual([
      [root.origin, { isModel: true, isValueType: true }],
      [root.cards[0], { isModel: true, isValueType: false }],
      [root.cards, { isModel: false, isValueType: false }],
    ])
  })
})

describe("idRefs", () => {
  const serializer = createSerializer({ serializers: [idRefs(), pathRefs()] })

  test("references models with an id, others fall through", () => {
    const root = createBoard()
    const json = serializer.encodeValue(root, [root.cards[0], root.notes[0], root])
    expect(json).toEqual([
      { $mobxKeystone: "idRef", v: { type: "serialization/references/Card", id: "c1" } },
      { $mobxKeystone: "pathRef", v: { path: ["notes", 0], ids: [null, null] } },
      { $mobxKeystone: "idRef", v: { type: "serialization/references/Board", id: "b1" } },
    ])
    const back = serializer.decodeValue(root, json) as unknown[]
    expect(back[0]).toBe(root.cards[0])
    expect(back[1]).toBe(root.notes[0])
    expect(back[2]).toBe(root)
  })

  test("the type must match and the id must exist", () => {
    const root = createBoard()
    for (const v of [
      { type: "serialization/references/Board", id: "c1" },
      { type: "serialization/references/Card", id: "nope" },
    ]) {
      const err = catchCallError(() => serializer.decodeValue(root, { $mobxKeystone: "idRef", v }))
      expect(err.code).toBe(CallErrorCode.NotFound)
    }
    const bad = catchCallError(() =>
      serializer.decodeValue(root, { $mobxKeystone: "idRef", v: { type: 1, id: "c1" } })
    )
    expect(bad.code).toBe(CallErrorCode.BadArgument)
  })

  test("models of another tree go as snapshots", () => {
    const root = createBoard()
    const other = createBoard()
    expect(serializer.encodeValue(root, other.cards[0])).toEqual(getSnapshot(other.cards[0]))
  })
})
