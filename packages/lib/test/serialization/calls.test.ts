import {
  _await,
  allowAnyCall,
  applyAction,
  applyCall,
  applyCallAsync,
  applyPatches,
  arrayActions,
  BuiltInAction,
  CallError,
  CallErrorCode,
  CallKind,
  clone,
  createSerializer,
  DataModel,
  defaultSerializer,
  deserializeActionCall,
  type EncodedCall,
  getCurrentActionContext,
  getSnapshot,
  idProp,
  idRefs,
  type JsonValue,
  Model,
  model,
  modelAction,
  MobxKeystoneError,
  modelFlow,
  onActionMiddleware,
  onPatches,
  type Patch,
  type ValueSerializer,
  pathRefs,
  prop,
  serializeActionCall,
  standaloneAction,
  standaloneFlow,
} from "../../src"
import { autoDispose } from "../utils"
import { catchCallError } from "./utils"

class AppError extends Error {}

@model("serialization/calls/Todo")
class Todo extends Model({ id: idProp, text: prop(""), done: prop(false).withSetter() }) {
  @modelAction
  setText(text: string) {
    this.text = text
  }
}

@model("serialization/calls/Point")
class Point extends DataModel({ x: prop<number>(), y: prop<number>() }) {
  @modelAction
  move(dx: number) {
    this.x += dx
    return this.x
  }

  @modelFlow
  *moveLater(dx: number) {
    yield* _await(Promise.resolve())
    this.x += dx
    return this.x
  }

  get length() {
    return Math.hypot(this.x, this.y)
  }
}

@model("serialization/calls/Store")
class Store extends Model({
  todos: prop<Todo[]>(() => []),
  count: prop(0),
  log: prop<string[]>(() => []),
  point: prop<{ x: number; y: number }>(() => ({ x: 3, y: 4 })),
}) {
  @modelAction
  add(todo: Todo) {
    this.todos.push(todo)
    return todo
  }

  @modelAction
  inc(by = 1) {
    this.count += by
    return this.count
  }

  @modelAction
  fail(): never {
    throw new AppError("app")
  }

  @modelAction
  createTodo(text: string) {
    const todo = new Todo({ text })
    this.todos.push(todo)
    return todo
  }

  @modelAction
  addRandom() {
    this.log.push(String(Math.random()))
  }

  @modelFlow
  *load(n: number) {
    yield* _await(Promise.resolve())
    this.count = n
    yield* _await(Promise.resolve())
    this.log.push(`loaded ${n}`)
    return n
  }

  findTodo(text: string) {
    return this.todos.find((t) => t.text === text)
  }

  get todoCount() {
    return this.todos.length
  }
}

const pushLog = standaloneAction("serialization/calls/pushLog", (store: Store, s: string) => {
  store.log.push(s)
  return store.log.length
})

const loadLater = standaloneFlow(
  "serialization/calls/loadLater",
  function* (store: Store, n: number) {
    yield* _await(Promise.resolve())
    store.count = n
    return n
  }
)

function createStore() {
  return new Store({ todos: [new Todo({ id: "t1", text: "one" })] })
}

const storeRef = { $mobxKeystone: "pathRef", v: { path: [] } }

describe("encodeCall / decodeCall / applyCall", () => {
  test("a model action, from JSON to its result", () => {
    const root = createStore()
    const call = defaultSerializer.decodeCall(root, { target: storeRef, name: "inc", args: [2] })
    expect(call.target).toBe(root)
    expect(call.name).toBe("inc")
    expect(call.kind).toBe(CallKind.ModelAction)
    expect(call.isFlow).toBe(false)
    expect(call.rawArgs).toEqual([2])
    expect(call.args).toEqual([2])
    expect(applyCall(root, call)).toBe(2)
    expect(root.count).toBe(2)
  })

  test("a call built in process", () => {
    const root = createStore()
    expect(applyCall(root, { target: root.todos[0], name: "setText", args: ["x"] })).toBe(undefined)
    expect(root.todos[0].text).toBe("x")
  })

  test("encodeCall from a Call and decodeCall round trip, with references in args", () => {
    const root = createStore()
    const todo = root.todos[0]
    const json = defaultSerializer.encodeCall(root, {
      target: todo,
      name: "setText",
      args: ["new"],
    })
    expect(json).toEqual({
      target: { $mobxKeystone: "pathRef", v: { path: ["todos", 0], ids: [null, "t1"] } },
      name: "setText",
      args: ["new"],
    })
    applyCall(root, defaultSerializer.decodeCall(root, JSON.parse(JSON.stringify(json))))
    expect(todo.text).toBe("new")
  })

  test("a detached argument goes as a snapshot and arrives as a new instance", () => {
    const root = createStore()
    const todo = new Todo({ id: "t2", text: "two" })
    const json = defaultSerializer.encodeCall(root, { target: root, name: "add", args: [todo] })
    expect(json.args).toEqual([getSnapshot(todo)])

    const other = clone(root, { generateNewIds: false })
    const result = applyCall<Todo>(other, defaultSerializer.decodeCall(other, json))
    expect(result).toBeInstanceOf(Todo)
    expect(result).not.toBe(todo)
    expect(other.todos[1]).toBe(result)
    expect(result.id).toBe("t2")
  })

  test("the target is always a reference, ignoring when, falling back to a pathRef", () => {
    const root = createStore()
    const never = createSerializer({ serializers: [pathRefs({ when: () => false })] })
    expect(
      never.encodeCall(root, { target: root.todos[0], name: "setText", args: [] }).target
    ).toEqual({ $mobxKeystone: "pathRef", v: { path: ["todos", 0], ids: [null, "t1"] } })

    const ids = createSerializer({ serializers: [idRefs()] })
    expect(
      ids.encodeCall(root, { target: root.todos[0], name: "setText", args: [] }).target
    ).toEqual({
      $mobxKeystone: "idRef",
      v: { type: "serialization/calls/Todo", id: "t1" },
    })
    // no id: full pathRef, which it decodes even without pathRefs in its list
    const json = ids.encodeCall(root, { target: root, name: "inc", args: [] })
    expect(json.target).toEqual({ $mobxKeystone: "pathRef", v: { path: [], ids: [] } })
    expect(ids.decodeCall(root, json).target).toBe(root)

    // no serializers at all
    const none = createSerializer()
    const noneJson = none.encodeCall(root, { target: root.todos[0], name: "setText", args: ["z"] })
    applyCall(root, none.decodeCall(root, noneJson))
    expect(root.todos[0].text).toBe("z")
  })

  test("a custom reference serializer references the target through claimsTarget", () => {
    const root = createStore()
    const isTodoOfStore = (value: unknown, root: object): value is Todo =>
      value instanceof Todo && (root as Store).todos.includes(value)
    const todoIndex: ValueSerializer<Todo, number> = {
      tag: "test/todoIndex",
      is: (value, ctx) => isTodoOfStore(value, ctx.root),
      encode: (todo, ctx) => (ctx.root as Store).todos.indexOf(todo),
      decode: (i, ctx) => (ctx.root as Store).todos[i],
    }
    const encodeTarget = (serializer: ValueSerializer) =>
      createSerializer({ serializers: [serializer] }).encodeCall(root, {
        target: root.todos[0],
        name: "setText",
        args: ["z"],
      }).target

    // without claimsTarget it isn't asked, and its references aren't accepted as targets
    expect(encodeTarget(todoIndex)).toEqual({
      $mobxKeystone: "pathRef",
      v: { path: ["todos", 0], ids: [null, "t1"] },
    })
    const byIndex = { $mobxKeystone: "test/todoIndex", v: 0 }
    const withoutClaims = createSerializer({ serializers: [todoIndex] })
    expect(
      catchCallError(() => withoutClaims.decodeCall(root, { target: byIndex, name: "setText" }))
        .code
    ).toBe(CallErrorCode.BadArgument)

    const reference: ValueSerializer<Todo, number> = {
      ...todoIndex,
      claimsTarget: (value, ctx) => isTodoOfStore(value, ctx.root),
    }
    const serializer = createSerializer({ serializers: [reference] })
    expect(encodeTarget(reference)).toEqual(byIndex)
    applyCall(root, serializer.decodeCall(root, { target: byIndex, name: "setText", args: ["z"] }))
    expect(root.todos[0].text).toBe("z")

    // what it decodes must still be a node of the tree
    const missing = { $mobxKeystone: "test/todoIndex", v: 5 }
    expect(
      catchCallError(() => serializer.decodeCall(root, { target: missing, name: "setText" })).code
    ).toBe(CallErrorCode.NotFound)
  })

  test("a reference serializer that throws on the target is CannotEncode at the target", () => {
    const root = createStore()
    const cause = new Error("boom")
    const throwing: ValueSerializer[] = [
      {
        tag: "test/throwsInClaims",
        is: (_v: unknown): _v is never => false,
        encode: () => 0,
        decode: () => undefined,
        claimsTarget: () => {
          throw cause
        },
      },
      {
        tag: "test/throwsInEncode",
        is: (_v: unknown): _v is never => false,
        encode: () => {
          throw cause
        },
        decode: () => undefined,
        claimsTarget: () => true,
      },
    ]
    for (const reference of throwing) {
      const err = catchCallError(() =>
        createSerializer({ serializers: [reference] }).encodeCall(root, {
          target: root.todos[0],
          name: "setText",
          args: ["z"],
        })
      )
      expect({ code: err.code, path: err.path, cause: err.cause }).toEqual({
        code: CallErrorCode.CannotEncode,
        path: ["target"],
        cause,
      })
      expect(err.message).toContain(`the '${reference.tag}' serializer failed to encode the value`)
    }
  })

  test("the target must be a reference to a node of the tree", () => {
    const root = createStore()
    const targets: JsonValue[] = [
      getSnapshot(root.todos[0]),
      5,
      { a: 1 },
      { $mobxKeystone: "date", v: 0 },
    ]
    for (const target of targets) {
      const err = catchCallError(() =>
        defaultSerializer.decodeCall(root, { target, name: "setText", args: [] })
      )
      expect(err.code).toBe(CallErrorCode.BadArgument)
      expect(err.path).toEqual(["target"])
    }

    const notFound = catchCallError(() =>
      defaultSerializer.decodeCall(root, {
        target: { $mobxKeystone: "pathRef", v: { path: ["todos", 3] } },
        name: "setText",
        args: [],
      })
    )
    expect(notFound.code).toBe(CallErrorCode.NotFound)
    expect(notFound.path).toEqual(["target"])

    const other = createStore()
    expect(
      catchCallError(() =>
        defaultSerializer.encodeCall(root, { target: other, name: "inc", args: [] })
      ).code
    ).toBe(CallErrorCode.NotFound)
    expect(
      catchCallError(() => applyCall(root, { target: other, name: "inc", args: [] })).code
    ).toBe(CallErrorCode.NotFound)
    // a decoded call applied to another tree
    const call = defaultSerializer.decodeCall(other, { target: storeRef, name: "inc", args: [] })
    expect(catchCallError(() => applyCall(root, call)).code).toBe(CallErrorCode.NotFound)
  })

  test("a target outside the tree says where it is", () => {
    const root = createStore()
    const other = createStore()
    const message = (target: object) =>
      catchCallError(() => applyCall(root, { target, name: "inc", args: [] })).message

    expect(message(other.todos[0])).toContain(`it is at path ["todos",0] of another tree`)
    expect(message(other)).toContain("it is the root of another tree (or detached)")
    expect(message({})).toContain("it is not a tree node")
  })

  test("an invalid call is BadArgument", () => {
    const root = createStore()
    for (const json of [
      null,
      5,
      {},
      { target: storeRef },
      { target: storeRef, name: "inc", args: 1 },
    ]) {
      expect(catchCallError(() => defaultSerializer.decodeCall(root, json as any)).code).toBe(
        CallErrorCode.BadArgument
      )
    }
  })

  test("an EncodedCall passed to applyCall says so", () => {
    const root = createStore()
    const json: EncodedCall = { target: storeRef, name: "inc", args: [] }
    expect(() => applyCall(root, json as any)).toThrow(
      "this looks like an EncodedCall; decode it first"
    )
  })

  test("an invalid call in process throws, in encodeCall, applyCall and applyCallAsync", async () => {
    const root = createStore()
    const invalidCalls: [unknown, string][] = [
      [null, "call must be an object"],
      [{ target: root, name: 5 }, "call name must be a string"],
      [{ target: root, name: "inc", args: 1 }, "call args must be an array or undefined"],
    ]
    for (const [call, message] of invalidCalls) {
      expect(() => defaultSerializer.encodeCall(root, call as any)).toThrow(message)
      expect(() => applyCall(root, call as any)).toThrow(message)
      await expect(applyCallAsync(root, call as any)).rejects.toThrow(message)
    }

    const actionCall = { actionName: "inc", args: [], targetPath: [], targetPathIds: [] }
    expect(() => defaultSerializer.encodeCall(root, { ...actionCall, serialized: true })).toThrow(
      "cannot encode a serialized action call; deserialize it first"
    )

    const err = catchCallError(() =>
      defaultSerializer.encodeCall(root, {
        ...actionCall,
        targetPath: ["todos", 5],
        targetPathIds: [null, "t5"],
      })
    )
    expect(err.code).toBe(CallErrorCode.NotFound)
    expect(err.path).toEqual(["target"])
  })

  test("root must be a tree root", () => {
    const root = createStore()
    const call = { target: root.todos[0], name: "setText", args: ["x"] }
    expect(() => applyCall(root.todos, call)).toThrow("root must be a tree root")
    expect(() => defaultSerializer.encodeCall(root.todos, call)).toThrow("root must be a tree root")
    expect(() =>
      defaultSerializer.decodeCall(root.todos, { target: storeRef, name: "x", args: [] })
    ).toThrow("root must be a tree root")
  })

  test("arguments are decoded on first read, once", () => {
    const root = createStore()
    const call = defaultSerializer.decodeCall(root, {
      target: storeRef,
      name: "add",
      args: [{ $modelType: "serialization/calls/Todo", id: "t5", text: "five", done: false }],
    })
    const args = call.args!
    expect(args[0]).toBeInstanceOf(Todo)
    expect(call.args).toBe(args)
  })

  test("argument decode errors have the path of the argument", () => {
    const root = createStore()
    const call = defaultSerializer.decodeCall(root, {
      target: storeRef,
      name: "inc",
      args: [1, { a: [{ $mobxKeystone: "pathRef", v: { path: ["nope"] } }] }],
    })
    const err = catchCallError(() => call.args)
    expect(err.code).toBe(CallErrorCode.NotFound)
    expect(err.path).toEqual(["args", 1, "a", 0])

    // and applyCall throws it before running anything
    expect(catchCallError(() => applyCall(root, call)).code).toBe(CallErrorCode.NotFound)
    expect(root.count).toBe(0)
  })

  test("app errors pass through unwrapped", () => {
    const root = createStore()
    expect(() => applyCall(root, { target: root, name: "fail", args: [] })).toThrow(AppError)
  })

  test("a CallError is a MobxKeystoneError with a JSON form", () => {
    const root = createStore()
    const err = catchCallError(() =>
      applyCall(root, { target: root, name: "$$applySnapshot", args: [{}] })
    )
    expect(err).toBeInstanceOf(MobxKeystoneError)
    expect(err.toJSON()).toEqual({ code: CallErrorCode.Forbidden, message: err.message, path: [] })
  })
})

describe("name resolution", () => {
  test("kind and isFlow for every step", () => {
    const root = createStore()
    const decode = (target: object, name: string, args: unknown[] | undefined = []) =>
      defaultSerializer.decodeCall(root, defaultSerializer.encodeCall(root, { target, name, args }))

    const cases: [object, string, CallKind, boolean][] = [
      [root, BuiltInAction.ApplySnapshot, CallKind.BuiltInAction, false],
      [root.point, "fn::serialization/calls/Point::move", CallKind.ModelAction, false],
      [root.point, "fn::serialization/calls/Point::moveLater", CallKind.ModelAction, true],
      [root.point, "fn::serialization/calls/Point::length", CallKind.View, false],
      [root, "serialization/calls/pushLog", CallKind.StandaloneAction, false],
      [root, "serialization/calls/loadLater", CallKind.StandaloneAction, true],
      [root.log, "mobx-keystone/arrayActions::push", CallKind.StandardAction, false],
      [root, "inc", CallKind.ModelAction, false],
      [root, "load", CallKind.ModelAction, true],
      [root.todos[0], "setDone", CallKind.ModelAction, false],
      [root, "findTodo", CallKind.View, false],
      [root, "todoCount", CallKind.View, false],
    ]
    for (const [target, name, kind, isFlow] of cases) {
      const call = decode(target, name)
      expect({ name, kind: call.kind, isFlow: call.isFlow }).toEqual({ name, kind, isFlow })
    }
  })

  test("hooks and unknown names are UnknownName, before canCall", () => {
    const root = createStore()
    let canCallRan = false
    const canCall = () => {
      canCallRan = true
      return true
    }
    for (const name of ["$$onInit", "$$onAttachedToRootStore", "nope", "toString", "onInit"]) {
      const err = catchCallError(() =>
        defaultSerializer.decodeCall(root, { target: storeRef, name, args: [] })
      )
      expect(err.code).toBe(CallErrorCode.UnknownName)
      expect(err.path).toEqual(["name"])
      expect(
        catchCallError(() => applyCall(root, { target: root, name, args: [] }, { canCall })).code
      ).toBe(CallErrorCode.UnknownName)
    }
    expect(canCallRan).toBe(false)

    expect(
      catchCallError(() => applyCall(root, { target: root, name: "$$onInit", args: [] })).message
    ).toContain("calls to hooks ($$onInit) cannot be applied")
  })
})

describe("canCall", () => {
  test("the default refuses everything but model actions, with nothing changed", () => {
    const root = createStore()
    const before = getSnapshot(root)
    const calls: [object, string, unknown[] | undefined, string][] = [
      [root, BuiltInAction.ApplySnapshot, [{ ...before, count: 5 }], "a built-in action"],
      [root, "serialization/calls/pushLog", ["x"], "a standalone action"],
      [root.log, "mobx-keystone/arrayActions::push", ["x"], "a standard action"],
      [root, "findTodo", ["one"], "a view"],
      [root, "todoCount", undefined, "a view"],
    ]
    for (const [target, name, args, kindDescription] of calls) {
      const err = catchCallError(() => applyCall(root, { target, name, args }))
      expect(err.code).toBe(CallErrorCode.Forbidden)
      expect(err.message).toContain(
        `'${name}' is ${kindDescription}, which the default canCall refuses; pass canCall to allow it`
      )
    }
    expect(getSnapshot(root)).toBe(before)
  })

  test("allowAnyCall allows everything", () => {
    const root = createStore()
    const opts = { canCall: allowAnyCall }
    applyCall(root, { target: root, name: BuiltInAction.ApplySet, args: ["count", 3] }, opts)
    expect(root.count).toBe(3)
    expect(
      applyCall(root, { target: root, name: "serialization/calls/pushLog", args: ["a"] }, opts)
    ).toBe(1)
    applyCall(
      root,
      { target: root.log, name: "mobx-keystone/arrayActions::push", args: ["b"] },
      opts
    )
    expect(root.log.slice()).toEqual(["a", "b"])
    expect(applyCall(root, { target: root, name: "findTodo", args: ["one"] }, opts)).toBe(
      root.todos[0]
    )
    expect(applyCall(root, { target: root, name: "todoCount" }, opts)).toBe(1)
  })

  test("a refusal by a custom canCall, and errors it throws pass through", () => {
    const root = createStore()
    const err = catchCallError(() =>
      applyCall(root, { target: root, name: "inc", args: [] }, { canCall: () => false })
    )
    expect(err.code).toBe(CallErrorCode.Forbidden)
    expect(err.message).toContain("'inc' (a model action) was refused by canCall")

    const thrown = new AppError("no")
    expect(() =>
      applyCall(
        root,
        { target: root, name: "inc", args: [] },
        {
          canCall: () => {
            throw thrown
          },
        }
      )
    ).toThrow(thrown)
    expect(root.count).toBe(0)
  })

  test("a refused call never decodes its arguments", () => {
    const root = createStore()
    const call = defaultSerializer.decodeCall(root, {
      target: storeRef,
      name: "add",
      args: [{ $mobxKeystone: "pathRef", v: { path: ["nope"] } }],
    })
    const err = catchCallError(() =>
      applyCall(root, call, {
        canCall: (c) => c.kind === CallKind.ModelAction && (c.rawArgs ?? []).length === 0,
      })
    )
    expect(err.code).toBe(CallErrorCode.Forbidden)
  })

  test("canCall gets the resolved call", () => {
    const root = createStore()
    let seen: unknown
    applyCall(
      root,
      { target: root, name: "inc", args: [4] },
      {
        canCall: (c) => {
          seen = { target: c.target, name: c.name, args: c.args, kind: c.kind, isFlow: c.isFlow }
          return true
        },
      }
    )
    expect(seen).toEqual({
      target: root,
      name: "inc",
      args: [4],
      kind: CallKind.ModelAction,
      isFlow: false,
    })
  })
})

describe("WrongKind", () => {
  const opts = { canCall: allowAnyCall }

  test.each([
    ["load", [1], "'load' is a flow; use applyCallAsync"],
    ["serialization/calls/loadLater", [1], "is a flow; use applyCallAsync"],
    ["inc", undefined, "'inc' is an action; pass args"],
    ["findTodo", undefined, "'findTodo' is a method; pass args"],
    ["todoCount", [], "'todoCount' is a getter; leave args out"],
  ])("%s", (name, args, message) => {
    const root = createStore()
    const err = catchCallError(() => applyCall(root, { target: root, name, args }, opts))
    expect(err.code).toBe(CallErrorCode.WrongKind)
    expect(err.message).toContain(message)
    expect(err.path).toEqual(["name"])
  })

  test("a data model flow is a flow too", () => {
    const root = createStore()
    const name = "fn::serialization/calls/Point::moveLater"
    expect(
      catchCallError(() => applyCall(root, { target: root.point, name, args: [] }, opts)).code
    ).toBe(CallErrorCode.WrongKind)
  })

  test("comes before canCall", () => {
    const root = createStore()
    const err = catchCallError(() =>
      applyCall(root, { target: root, name: "inc" }, { canCall: () => false })
    )
    expect(err.code).toBe(CallErrorCode.WrongKind)
  })
})

describe("flows", () => {
  test("applyCallAsync runs flows and resolves to their result", async () => {
    const root = createStore()
    const call = defaultSerializer.decodeCall(root, { target: storeRef, name: "load", args: [7] })
    expect(call.isFlow).toBe(true)
    await expect(applyCallAsync(root, call)).resolves.toBe(7)
    expect(root.count).toBe(7)

    await expect(
      applyCallAsync(
        root,
        { target: root, name: "serialization/calls/loadLater", args: [8] },
        {
          canCall: allowAnyCall,
        }
      )
    ).resolves.toBe(8)
    expect(root.count).toBe(8)

    // the same flow, called directly
    await expect(loadLater(root, 9)).resolves.toBe(9)
  })

  test("re-registering a standalone name replaces whether it is a flow", () => {
    const root = createStore()
    const name = "serialization/calls/reRegistered"
    const call = { target: root, name, args: [3] }
    const opts = { canCall: allowAnyCall }

    standaloneFlow(name, function* (store: Store, n: number) {
      yield* _await(Promise.resolve())
      store.count = n
      return n
    })
    expect(catchCallError(() => applyCall(root, call, opts)).code).toBe(CallErrorCode.WrongKind)

    // as with hot reloading, the newest registration wins
    standaloneAction(name, (store: Store, n: number) => {
      store.count = n
      return n
    })
    expect(applyCall(root, call, opts)).toBe(3)
    expect(root.count).toBe(3)
  })

  test("applyCallAsync accepts synchronous calls too", async () => {
    const root = createStore()
    await expect(applyCallAsync(root, { target: root, name: "inc", args: [2] })).resolves.toBe(2)
  })

  test("every applyCallAsync error is a rejection", async () => {
    const root = createStore()
    await expect(
      applyCallAsync(root.todos, { target: root, name: "inc", args: [] })
    ).rejects.toThrow("root must be a tree root")
    await expect(
      applyCallAsync(root, { target: root, name: "nope", args: [] })
    ).rejects.toBeInstanceOf(CallError)
    await expect(
      applyCallAsync(root, { target: root, name: "$$applySnapshot", args: [{}] })
    ).rejects.toBeInstanceOf(CallError)
    await expect(
      applyCallAsync(root, { target: root, name: "fail", args: [] })
    ).rejects.toBeInstanceOf(AppError)
  })
})

describe("standalone actions", () => {
  test("a standalone action round trips with the target once", () => {
    const root = createStore()
    const encoded: EncodedCall[] = []
    autoDispose(
      onActionMiddleware(root, {
        onStart(actionCall) {
          encoded.push(defaultSerializer.encodeCall(root, actionCall))
        },
      })
    )
    pushLog(root, "x")
    arrayActions.push(root.log, "y")
    expect(encoded).toEqual([
      {
        target: { $mobxKeystone: "pathRef", v: { path: [], ids: [] } },
        name: "serialization/calls/pushLog",
        args: ["x"],
      },
      {
        target: { $mobxKeystone: "pathRef", v: { path: ["log"], ids: [null] } },
        name: "mobx-keystone/arrayActions::push",
        args: ["y"],
      },
    ])

    const other = createStore()
    for (const json of encoded) {
      applyCall(other, defaultSerializer.decodeCall(other, json), { canCall: allowAnyCall })
    }
    expect(other.log.slice()).toEqual(["x", "y"])
  })

  test("an old serialized call converted with encodeCall runs the same", () => {
    const root = createStore()
    // serialized the old way, in onStart
    const old: ReturnType<typeof serializeActionCall>[] = []
    autoDispose(
      onActionMiddleware(root, {
        onStart(actionCall) {
          old.push(serializeActionCall(actionCall, root))
        },
      })
    )
    pushLog(root, "x")
    root.inc(3)
    root.add(new Todo({ id: "t9", text: "nine" }))

    const other = createStore()
    for (const serializedOld of old) {
      const json = defaultSerializer.encodeCall(other, deserializeActionCall(serializedOld, other))
      applyCall(other, defaultSerializer.decodeCall(other, json), { canCall: allowAnyCall })
    }
    expect(getSnapshot(other)).toEqual(getSnapshot(root))
  })
})

describe("applyAction", () => {
  test("still calls everything, from a subtree", () => {
    const root = createStore()
    applyAction(root, {
      actionName: BuiltInAction.ApplySet,
      args: ["count", 2],
      targetPath: [],
      targetPathIds: [],
    })
    expect(root.count).toBe(2)

    applyAction(root.todos, {
      actionName: "setText",
      args: ["sub"],
      targetPath: [0],
      targetPathIds: ["t1"],
    })
    expect(root.todos[0].text).toBe("sub")

    applyAction(root, {
      actionName: "serialization/calls/pushLog",
      args: [root, "x"],
      targetPath: [],
      targetPathIds: [],
    })
    expect(root.log.slice()).toEqual(["x"])

    expect(
      applyAction(root, {
        actionName: "fn::serialization/calls/Point::move",
        args: [1],
        targetPath: ["point"],
        targetPathIds: [null],
      })
    ).toBe(4)
    expect(new Point(root.point).x).toBe(4)
  })

  test("keeps its messages", () => {
    const root = createStore()
    const call =
      (actionName: string, targetPath: (string | number)[] = []) =>
      () =>
        applyAction(root, {
          actionName,
          args: [],
          targetPath,
          targetPathIds: targetPath.map(() => null),
        })
    expect(call("findTodo")).toThrow("action 'findTodo' is not a model action")
    expect(call("todoCount")).toThrow("action 'todoCount' is not a model action")
    expect(call("count")).toThrow("action 'count' is not a model action")
    expect(call("toString")).toThrow("action 'toString' could not be resolved to a function")
    expect(call("nope")).toThrow("action 'nope' could not be resolved to a function")
    expect(call("$$onInit")).toThrow("calls to hooks ($$onInit) cannot be applied")
    expect(call("inc", ["nope"])).toThrow(
      `object at path ["nope"] with ids [null] could not be resolved`
    )
  })
})

describe("onActionMiddleware", () => {
  test("a call encoded in onStart with a detached argument the action attaches runs the same", () => {
    const client = createStore()
    const server = clone(client, { generateNewIds: false })

    const encoded: EncodedCall[] = []
    autoDispose(
      onActionMiddleware(client, {
        onStart(actionCall) {
          encoded.push(defaultSerializer.encodeCall(client, actionCall))
        },
      })
    )
    client.add(new Todo({ id: "t2", text: "two" }))

    expect(encoded).toHaveLength(1)
    applyCall(server, defaultSerializer.decodeCall(server, JSON.parse(JSON.stringify(encoded[0]))))
    expect(getSnapshot(server)).toEqual(getSnapshot(client))
  })
})

describe("calls in, patches out", () => {
  test("every replica ends up equal to the server", async () => {
    const server = createStore()
    const client = clone(server, { generateNewIds: false })
    const liveReplica = clone(server, { generateNewIds: false })

    const broadcast: { patches: Patch[]; action: string | undefined }[] = []
    autoDispose(
      onPatches(server, (patches) => {
        broadcast.push({ patches, action: getCurrentActionContext()?.rootContext.actionName })
        applyPatches(liveReplica, patches)
      })
    )

    const send = async (json: EncodedCall) => {
      const call = defaultSerializer.decodeCall(server, JSON.parse(JSON.stringify(json)))
      const result = call.isFlow ? await applyCallAsync(server, call) : applyCall(server, call)
      return defaultSerializer.encodeValue(server, result)
    }

    const encode = (target: object, name: string, args: unknown[]) =>
      defaultSerializer.encodeCall(client, { target, name, args })

    // a flow with other calls between its steps
    const flowDone = send(encode(client, "load", [5]))
    await send(encode(client, "inc", [1]))
    await send(encode(client, "addRandom", []))
    // a model created without an id
    const created = await send(encode(client, "createTodo", ["new"]))
    await send(encode(client.todos[0], "setDone", [true]))
    await flowDone

    // the flow's steps ran between the other calls
    expect(broadcast.map((b) => b.action)).toEqual([
      "inc",
      "load",
      "addRandom",
      "load",
      "createTodo",
      "setDone",
    ])

    for (const { patches } of broadcast) {
      applyPatches(client, patches)
    }
    expect(getSnapshot(client)).toEqual(getSnapshot(server))
    expect(getSnapshot(liveReplica)).toEqual(getSnapshot(server))

    // the result is a reference into the tree the client now has
    expect(defaultSerializer.decodeValue(client, created)).toBe(client.todos[1])
  })

  test("generateNewIds lets the server accept the same snapshot twice", () => {
    const server = createStore()
    const replica = clone(server, { generateNewIds: false })
    autoDispose(onPatches(server, (patches) => applyPatches(replica, patches)))

    // e.g. a todo imported from a file, twice
    const json = JSON.parse(
      JSON.stringify(
        defaultSerializer.encodeCall(server, {
          target: server,
          name: "add",
          args: [new Todo({ id: "imported", text: "file" })],
        })
      )
    ) as EncodedCall

    for (let i = 0; i < 2; i++) {
      applyCall(server, defaultSerializer.decodeCall(server, json, { generateNewIds: true }))
    }

    const ids = server.todos.map((t) => t.id)
    expect(ids).toHaveLength(3)
    expect(ids[0]).toBe("t1")
    expect(new Set(ids).size).toBe(3)
    expect(ids).not.toContain("imported")
    expect(server.todos.map((t) => t.text)).toEqual(["one", "file", "file"])
    expect(getSnapshot(replica)).toEqual(getSnapshot(server))

    // by default the ids are kept, e.g. for replicas decoding calls the server sends back
    const kept = defaultSerializer.decodeCall(server, json).args![0] as Todo
    expect(kept.id).toBe("imported")
  })
})
