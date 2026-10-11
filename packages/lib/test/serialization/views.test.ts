import { computed } from "mobx"
import {
  allowAnyCall,
  applyCall,
  applyCallAsync,
  CallError,
  CallErrorCode,
  CallKind,
  createSerializer,
  DataModel,
  defaultSerializer,
  ExtendedModel,
  idProp,
  idRefs,
  Model,
  model,
  modelAction,
  onActionMiddleware,
  prop,
  type ResolvedCall,
  tProp,
  types,
} from "../../src"
import { autoDispose } from "../utils"
import { catchCallError } from "./utils"

let getterRuns = 0

@model("serialization/views/Card")
class Card extends Model({ id: idProp, text: prop(""), done: prop(false) }) {
  @modelAction
  setDone(done: boolean) {
    this.done = done
  }
}

@model("serialization/views/BaseBoard")
class BaseBoard extends Model({ cards: prop<Card[]>(() => []), count: prop(0) }) {
  baseView() {
    return "base"
  }

  onInit() {}

  onAttachedToRootStore() {
    return undefined
  }
}

const hiddenFn = Symbol("hiddenFn")

@model("serialization/views/Board")
class Board extends ExtendedModel(BaseBoard, {
  size: prop<{ w: number; h: number }>(() => ({ w: 1, h: 2 })),
}) {
  arrowView = (text: string) => this.findCards(text).length;

  [hiddenFn] = () => "hidden"

  findCards(text: string): Card[] {
    return this.cards.filter((c) => c.text.includes(text))
  }

  get doneCount() {
    getterRuns++
    return this.cards.filter((c) => c.done).length
  }

  markAllDone() {
    for (const card of this.cards) {
      card.setDone(true)
    }
    return this.doneCount
  }

  asyncViewRuns = 0

  async asyncView() {
    this.asyncViewRuns++
    return 1
  }

  throwingView(): never {
    throw new Error("view error")
  }
}

@model("serialization/views/Size")
class Size extends DataModel({ w: prop<number>(), h: prop<number>() }) {
  arrowArea = () => this.w * this.h

  get area() {
    return this.w * this.h
  }

  scaled(f: number) {
    return { w: this.w * f, h: this.h * f }
  }

  protected onLazyInit() {}
}

@model("serialization/views/TypedSize")
class TypedSize extends DataModel({ w: tProp(types.number), h: tProp(types.number) }) {
  get area() {
    return this.w * this.h
  }
}

function createBoard() {
  return new Board({
    cards: [new Card({ id: "c1", text: "urgent a" }), new Card({ id: "c2", text: "b" })],
  })
}

const llmSerializer = createSerializer({
  serializers: [idRefs()],
})

const opts = { canCall: (call: ResolvedCall) => call.kind === CallKind.View }

function view(root: Board, target: object, name: string, args?: unknown[]) {
  const call = llmSerializer.decodeCall(
    root,
    llmSerializer.encodeCall(root, { target, name, args })
  )
  return { call, result: () => applyCall(root, call, opts) }
}

test("methods are called and their result encoded", () => {
  const root = createBoard()
  const { call, result } = view(root, root, "findCards", ["urgent"])
  expect(call.kind).toBe(CallKind.View)
  expect(llmSerializer.encodeValue(root, result())).toEqual([
    { $mobxKeystone: "idRef", v: { type: "serialization/views/Card", id: "c1" } },
  ])
})

test("getters are read without args, and never run while resolving", () => {
  const root = createBoard()
  getterRuns = 0
  const { call, result } = view(root, root, "doneCount")
  expect(call.kind).toBe(CallKind.View)
  expect(getterRuns).toBe(0)
  expect(result()).toBe(0)
  expect(getterRuns).toBe(1)
})

test("model props can be read", () => {
  const root = createBoard()
  expect(view(root, root, "count").result()).toBe(0)
  expect(view(root, root, "size").result()).toBe(root.size)
})

test("own function fields and members of base model classes are views", () => {
  const root = createBoard()
  expect(view(root, root, "arrowView", ["urgent"]).result()).toBe(1)
  expect(view(root, root, "baseView", []).result()).toBe("base")
})

test("inherited members, hooks, library internals and constructor are unknown", () => {
  const root = createBoard()
  for (const name of [
    "toString",
    "hasOwnProperty",
    "__proto__",
    "constructor",
    "onInit",
    "onAttachedToRootStore",
    "$",
    "$modelType",
    "typeCheck",
    "getRefId",
    "hiddenFn",
    String(hiddenFn),
  ]) {
    const err = catchCallError(() =>
      llmSerializer.decodeCall(root, {
        target: { $mobxKeystone: "pathRef", v: { path: [] } },
        name,
        args: [],
      })
    )
    expect({ name, code: err.code }).toEqual({ name, code: CallErrorCode.UnknownName })
  }
})

test("own getters are views too, e.g. computeds MobX defines on the instance", () => {
  const root = createBoard()
  Object.defineProperty(root, "ownGetter", { get: () => 42, configurable: true })
  expect(view(root, root, "ownGetter").result()).toBe(42)
})

test("views run in one batch: an unobserved computed is computed once", () => {
  const root = createBoard()
  let runs = 0
  const expensive = computed(() => {
    runs++
    return root.cards.length
  })
  // reading it outside a batch recomputes every time
  expensive.get()
  expensive.get()
  expect(runs).toBe(2)

  runs = 0
  ;(root as any).readTwice = () => expensive.get() + expensive.get()
  expect(view(root, root, "readTwice", []).result()).toBe(4)
  expect(runs).toBe(1)
})

test("actions a view calls run normally, unchecked by canCall", () => {
  const root = createBoard()
  const started: string[] = []
  autoDispose(
    onActionMiddleware(root, {
      onStart(actionCall) {
        started.push(actionCall.actionName)
      },
    })
  )
  expect(view(root, root, "markAllDone", []).result()).toBe(2)
  expect(started).toEqual(["setDone", "setDone"])
})

test("a view returning a promise is WrongKind, after it ran", async () => {
  const root = createBoard()
  const err = catchCallError(() => view(root, root, "asyncView", []).result())
  expect(err.code).toBe(CallErrorCode.WrongKind)
  expect(err.message).toContain("'asyncView' returned a promise; async reads belong in a flow")
  expect(root.asyncViewRuns).toBe(1)

  await expect(
    applyCallAsync(root, { target: root, name: "asyncView", args: [] }, opts)
  ).rejects.toBeInstanceOf(CallError)
})

test("errors thrown by a view pass through", () => {
  const root = createBoard()
  expect(() => view(root, root, "throwingView", []).result()).toThrow("view error")
})

test("reading a method or calling a getter is WrongKind", () => {
  const root = createBoard()
  expect(catchCallError(() => view(root, root, "findCards").result()).message).toContain(
    "'findCards' is a method; pass args"
  )
  expect(catchCallError(() => view(root, root, "doneCount", []).result()).message).toContain(
    "'doneCount' is a getter; leave args out"
  )
})

describe("data models", () => {
  test("getters, methods and function fields of the data model", () => {
    const root = createBoard()
    expect(view(root, root.size, "fn::serialization/views/Size::area").call.kind).toBe(
      CallKind.View
    )
    expect(view(root, root.size, "fn::serialization/views/Size::area").result()).toBe(2)
    expect(view(root, root.size, "fn::serialization/views/Size::scaled", [2]).result()).toEqual({
      w: 2,
      h: 4,
    })
    expect(view(root, root.size, "fn::serialization/views/Size::arrowArea", []).result()).toBe(2)
    expect(new Size(root.size).area).toBe(2)
  })

  test("internals and unknown members are unknown", () => {
    const root = createBoard()
    const names = [
      ...["$", "typeCheck", "onLazyInit", "toString", "constructor", "nope"].map(
        (member) => `fn::serialization/views/Size::${member}`
      ),
      "fn::",
      "fn::x",
      "fn::nope::area",
      // not a data model
      "fn::serialization/views/Card::setDone",
    ]
    for (const name of names) {
      const err = catchCallError(() => applyCall(root, { target: root.size, name, args: [] }, opts))
      expect({ name, code: err.code }).toEqual({ name, code: CallErrorCode.UnknownName })
    }
  })

  test("data of the wrong shape runs as applyAction would", () => {
    const root = createBoard()
    const result = applyCall(
      root,
      { target: root.cards[0], name: "fn::serialization/views/Size::area" },
      { canCall: allowAnyCall }
    )
    expect(result).toBeNaN()
  })

  test("data its data model can't be created over is WrongKind, sending nothing of it", () => {
    const root = createBoard()
    const area = "fn::serialization/views/TypedSize::area"
    expect(view(root, root.size, area).result()).toBe(new TypedSize(root.size).area)

    const err = catchCallError(() =>
      applyCall(root, { target: root.cards[0], name: area }, { canCall: allowAnyCall })
    )
    expect(err.code).toBe(CallErrorCode.WrongKind)
    expect(err.path).toEqual(["target"])
    expect(JSON.stringify(err.toJSON())).not.toContain("urgent a")
  })
})

test("views are refused by the default canCall", () => {
  const root = createBoard()
  const call = defaultSerializer.decodeCall(root, {
    target: { $mobxKeystone: "pathRef", v: { path: [] } },
    name: "doneCount",
  })
  expect(catchCallError(() => applyCall(root, call)).code).toBe(CallErrorCode.Forbidden)
})
