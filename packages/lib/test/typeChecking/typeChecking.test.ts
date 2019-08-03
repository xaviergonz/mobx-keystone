import { reaction } from "mobx"
import { assert, _ } from "spec.ts"
import {
  actionTrackingMiddleware,
  AnyModel,
  AnyType,
  frozen,
  model,
  Model,
  modelAction,
  ModelAutoTypeCheckingMode,
  newModel,
  onPatches,
  onSnapshot,
  ref,
  Ref,
  resolvePath,
  setGlobalConfig,
  typeCheck,
  TypeCheckError,
  types,
  TypeToData,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

beforeEach(() => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
  })
})

function expectTypeCheckError(m: AnyModel, fn: () => void) {
  const snapshots: any[] = []
  const disposer1 = onSnapshot(m, sn => {
    snapshots.push(sn)
  })
  const patches: any[] = []
  const disposer2 = onPatches(m, p => {
    patches.push(p)
  })
  const actions: any[] = []
  const disposer3 = actionTrackingMiddleware(m, {
    onStart(ctx) {
      actions.push({ type: "start", ctx })
    },
    onFinish(ctx, ret) {
      actions.push({ type: "finish", result: ret.result, ctx })
    },
  })

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  expect(fn).toThrow("TypeCheckError")

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
  })

  disposer1()
  disposer2()
  disposer3()

  expect(actions).toHaveLength(2)
  expect(actions).toMatchSnapshot()
  expect(snapshots).toEqual([])
  expect(patches).toEqual([])
}

// just used to check the value conforms to the type
function tsCheck<T>(_val: T): void {}

function expectTypeCheckOk<T extends AnyType>(t: T, val: TypeToData<T>) {
  const err = typeCheck(t, val)
  expect(err).toBeNull()
}

function expectTypeCheckFail<T extends AnyType>(
  t: T,
  val: any,
  path: ReadonlyArray<string | number>,
  expected: string
) {
  const err = typeCheck(t, val)
  const actualValue = resolvePath(val, path)
  expect(err).toEqual(new TypeCheckError(path, expected, actualValue))
}

test("literal", () => {
  const type = types.literal("hi")
  assert(_ as TypeToData<typeof type>, "hi")

  expectTypeCheckOk(type, "hi")
  expectTypeCheckFail(type, "ho", [], JSON.stringify("hi"))
})

test("undefined", () => {
  const type = types.undefined
  assert(_ as TypeToData<typeof type>, undefined)

  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(type, "ho", [], "undefined")
})

test("null", () => {
  const type = types.null
  assert(_ as TypeToData<typeof type>, null)

  expectTypeCheckOk(type, null)
  expectTypeCheckFail(type, "ho", [], "null")
})

test("boolean", () => {
  const type = types.boolean
  assert(_ as TypeToData<typeof type>, _ as boolean)

  expectTypeCheckOk(type, false)
  expectTypeCheckFail(type, "ho", [], "boolean")
})

test("number", () => {
  const type = types.number
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 6)
  expectTypeCheckFail(type, "ho", [], "number")
})

test("string", () => {
  const type = types.string
  assert(_ as TypeToData<typeof type>, _ as string)

  expectTypeCheckOk(type, "hello")
  expectTypeCheckFail(type, 5, [], "string")
})

test("or - simple types", () => {
  const type = types.or(types.number, types.boolean)
  assert(_ as TypeToData<typeof type>, _ as number | boolean)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, false)
  expectTypeCheckFail(type, "ho", [], "number | boolean")
})

test("maybe", () => {
  const type = types.maybe(types.number)
  assert(_ as TypeToData<typeof type>, _ as number | undefined)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(type, "ho", [], "number | undefined")
})

test("maybeNull", () => {
  const type = types.maybeNull(types.number)
  assert(_ as TypeToData<typeof type>, _ as number | null)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, null)
  expectTypeCheckFail(type, "ho", [], "number | null")
})

test("array - simple types", () => {
  const type = types.array(types.number)
  assert(_ as TypeToData<typeof type>, _ as number[])

  expectTypeCheckOk(type, [])
  expectTypeCheckOk(type, [1, 2, 3])
  expectTypeCheckFail(type, "ho", [], "Array<number>")
  expectTypeCheckFail(type, ["ho"], [0], "number")
})

test("objectMap - simple types", () => {
  const type = types.objectMap(types.number)
  assert(_ as TypeToData<typeof type>, _ as { [k: string]: number })

  expectTypeCheckOk(type, {})
  expectTypeCheckOk(type, { x: 5, y: 6 })
  expectTypeCheckFail(type, "ho", [], "ObjectMap<number>")
  const wrongValue = { x: 5, y: "6" }
  expectTypeCheckFail(type, wrongValue, ["y"], "number")
})

test("unchecked", () => {
  const type = types.unchecked<number>()
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, { x: 5, y: 6 } as any)
  expectTypeCheckOk(type, "ho" as any)
})

test("object - simple types", () => {
  const type = types.object(() => ({
    x: types.number,
    y: types.string,
  }))
  assert(_ as TypeToData<typeof type>, _ as { x: number; y: string })

  expectTypeCheckOk(type, { x: 5, y: "6" })

  const expected = "{ x: number; y: string; }"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { x: 5, y: 6 }, ["y"], "string")
  expectTypeCheckFail(type, { x: 5, y: "6", z: 10 }, [], expected)
})

test("object - all optional simple types", () => {
  const type = types.object(() => ({
    x: types.maybe(types.number),
    y: types.maybe(types.string),
  }))
  assert(_ as TypeToData<typeof type>, _ as { x?: number; y?: string })

  expectTypeCheckOk(type, { x: 5, y: "6" })
  expectTypeCheckOk(type, { x: undefined })
  expectTypeCheckOk(type, { y: undefined })
  expectTypeCheckOk(type, { x: 5 })
  expectTypeCheckOk(type, { y: "6" })
  expectTypeCheckOk(type, {})

  const expected = "{ x: number | undefined; y: string | undefined; }"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { x: 5, y: 6 }, ["y"], "string | undefined")
  expectTypeCheckFail(type, { x: 5, y: "6", z: 10 }, [], expected)
})

const mType = types.object(() => ({
  x: types.number,
  y: types.string,
}))

@model("M", { dataType: mType })
class M extends Model<TypeToData<typeof mType>>() {
  defaultData = { x: 10 }

  @modelAction
  setX(v: number) {
    this.$.x = v
  }
}

test("model", () => {
  const m = newModel(M, { y: "6" })
  const type = types.model<M>(M)
  assert(_ as TypeToData<typeof type>, _ as M)

  expectTypeCheckOk(type, m)
  expect(m.typeCheck()).toBeNull()

  expectTypeCheckFail(type, "ho", [], `Model(${m.modelType})`)
  expectTypeCheckFail(type, newModel(MR, {}), [], `Model(${m.modelType})`)
  m.setX("10" as any)
  expectTypeCheckFail(type, m, ["$", "x"], "number")
  expect(m.typeCheck()).toEqual(new TypeCheckError(["$", "x"], "number", "10"))
})

test("model typechecking", () => {
  const m = newModel(M, { y: "6" })
  const type = types.model<M>(M)
  assert(_ as TypeToData<typeof type>, _ as M)

  expectTypeCheckOk(type, m)

  // make sure reaction doesn't run when we revert the change
  let reactionRun = 0
  autoDispose(
    reaction(
      () => m.$.x,
      () => {
        reactionRun++
      }
    )
  )

  expectTypeCheckError(m, () => {
    m.setX("5" as any)
  })
  expect(reactionRun).toBe(0)
  expect(m.$.x).toBe(10)
  expectTypeCheckOk(type, m)
})

test("newModel with typechecking enabled", () => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  expect(() => newModel(M, { x: 10, y: 20 as any })).toThrow(
    "TypeCheckError: [$/y] Expected: string"
  )
})

test("model", () => {
  const m = newModel(M, { y: "6" })
  const type = types.model<M>(M)
  assert(_ as TypeToData<typeof type>, _ as M)

  expectTypeCheckOk(type, m)

  expectTypeCheckFail(type, "ho", [], `Model(${m.modelType})`)
  m.setX("10" as any)
  expectTypeCheckFail(type, m, ["$", "x"], "number")
})

test("array - complex types", () => {
  const type = types.array(
    types.object(() => ({
      x: types.number,
    }))
  )
  assert(_ as TypeToData<typeof type>, _ as ({ x: number })[])

  expectTypeCheckOk(type, [{ x: 5 }])

  const expected = "Array<{ x: number; }>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, [5], [0], "{ x: number; }")
  expectTypeCheckFail(type, [{ x: "5" }], [0, "x"], "number")
})

test("array - unchecked", () => {
  const type = types.array(types.unchecked<number>())
  assert(_ as TypeToData<typeof type>, _ as number[])

  expectTypeCheckOk(type, [1, 2, 3])

  const expected = "Array<any>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckOk(type, ["1"] as any)
})

test("object - complex types", () => {
  const type = types.object(() => ({
    x: types.maybe(types.number),
    o: types.object(() => ({
      y: types.string,
    })),
  }))
  assert(
    _ as TypeToData<typeof type>,
    _ as {
      x?: number
      o: {
        y: string
      }
    }
  )

  expectTypeCheckOk(type, { x: 5, o: { y: "6" } })

  const expected = "{ x: number | undefined; o: { y: string; }; }"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { x: 5, o: 6 }, ["o"], "{ y: string; }")
  expectTypeCheckFail(type, { x: 5, o: { y: "6" }, z: 10 }, [], expected)
  expectTypeCheckFail(type, { x: 5, o: { y: 6 } }, ["o", "y"], "string")
})

test("objectMap - complex types", () => {
  const type = types.objectMap(
    types.object(() => ({
      y: types.string,
    }))
  )
  assert(_ as TypeToData<typeof type>, _ as { [k: string]: { y: string } })

  expectTypeCheckOk(type, { o: { y: "6" } })

  const expected = "ObjectMap<{ y: string; }>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { o: 6 }, ["o"], "{ y: string; }")
  expectTypeCheckFail(type, { o: { y: 6 } }, ["o", "y"], "string")
})

test("or - complex types", () => {
  const type = types.or(
    types.object(() => ({
      y: types.string,
    })),
    types.number
  )
  assert(_ as TypeToData<typeof type>, _ as number | ({ y: string }))

  expectTypeCheckOk(type, { y: "6" })
  expectTypeCheckOk(type, 6)

  const expected = "{ y: string; } | number"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { y: 6 }, [], expected)
})

test("or - one type unchecked", () => {
  const type = types.or(types.number, types.boolean, types.unchecked<string>())
  assert(_ as TypeToData<typeof type>, _ as string | number | boolean)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, false)
  expectTypeCheckOk(type, "ho")
})

test("recursive object", () => {
  const type = types.object(() => ({
    x: types.number,
    rec: types.maybe(type),
  }))

  tsCheck<TypeToData<typeof type>>({ x: 5, rec: undefined })
  tsCheck<TypeToData<typeof type>>({ x: 5, rec: { x: 6, rec: undefined } })
  tsCheck<TypeToData<typeof type>>({ x: 5 })
  tsCheck<TypeToData<typeof type>>({ x: 5, rec: { x: 6 } })

  expectTypeCheckOk(type, { x: 5, rec: undefined })
  expectTypeCheckOk(type, { x: 5, rec: { x: 6, rec: undefined } })
  expectTypeCheckOk(type, { x: 5 })
  expectTypeCheckOk(type, { x: 5, rec: { x: 6 } })

  expectTypeCheckFail(
    type,
    { x: 5, rec: { x: "6" } },
    ["rec"],
    // won't say anything of the wrong x because of the or (maybe) type
    "{ x: number; rec: ...; } | undefined"
  )
})

test("cross referenced object", () => {
  const typeA = types.object(() => ({
    x: types.number,
    b: types.maybe(typeB),
  }))

  const typeB = types.object(() => ({
    y: types.number,
    a: types.maybe(typeA),
  }))

  tsCheck<TypeToData<typeof typeA>>({ x: 5, b: undefined })
  tsCheck<TypeToData<typeof typeA>>({ x: 5, b: { y: 5, a: undefined } })
  tsCheck<TypeToData<typeof typeA>>({ x: 5, b: { y: 5, a: { x: 6, b: undefined } } })

  expectTypeCheckOk(typeA, { x: 5, b: undefined })
  expectTypeCheckOk(typeA, { x: 5, b: { y: 5, a: undefined } })
  expectTypeCheckOk(typeA, { x: 5, b: { y: 5, a: { x: 6, b: undefined } } })

  expectTypeCheckFail(
    typeA,
    { x: 5, b: { y: "6", a: undefined } },
    ["b"],
    // won't say anything of the wrong y because of the or (maybe) type
    "{ y: number; a: { x: number; b: ...; } | undefined; } | undefined"
  )
})

const mrType = types.object(() => ({
  x: types.number,
  rec: types.maybe(types.model<MR>(() => MR)),
}))

@model("MR", { dataType: mrType })
class MR extends Model<TypeToData<typeof mrType>>() {
  defaultData = {
    x: 10,
    rec: undefined,
  }

  @modelAction
  setRec(r: MR | undefined) {
    this.$.rec = r
  }
}

test("recursive model", () => {
  const type = types.model<MR>(MR)

  const mr = newModel(MR, { rec: newModel(MR, {}) })
  assert(_ as TypeToData<typeof type>, _ as MR)

  expectTypeCheckOk(type, mr)

  mr.setRec("5" as any)
  expectTypeCheckFail(type, mr, ["$", "rec"], "Model(MR) | undefined")
})

const maType = types.object(() => ({
  x: types.number,
  b: types.maybe(types.model<MB>(() => MB)),
}))

@model("MA", { dataType: maType })
class MA extends Model<TypeToData<typeof maType>>() {
  defaultData = {
    x: 10,
    b: undefined,
  }

  @modelAction
  setB(r: MB | undefined) {
    this.$.b = r
  }
}

const mbType = types.object(() => ({
  y: types.number,
  a: types.maybe(types.model<MA>(MA)),
}))

@model("MB", { dataType: mbType })
class MB extends Model<TypeToData<typeof mbType>>() {
  defaultData = {
    y: 20,
    a: undefined,
  }

  @modelAction
  setA(r: MA | undefined) {
    this.$.a = r
  }
}

test("cross referenced model", () => {
  const type = types.model<MA>(MA)

  const ma = newModel(MA, { b: newModel(MB, { a: newModel(MA, {}) }) })
  assert(_ as TypeToData<typeof type>, _ as MA)

  expectTypeCheckOk(type, ma)

  ma.$.b!.setA("5" as any)
  expectTypeCheckFail(type, ma, ["$", "b"], "Model(MB) | undefined")
})

test("ref", () => {
  const type = types.ref<M>()

  const m = newModel(M, { y: "6" })
  const r = ref(m)
  assert(_ as TypeToData<typeof type>, _ as Ref<M>)

  expectTypeCheckOk(type, r)
  expectTypeCheckFail(type, m, [], "Model($$Ref)")
})

test("frozen - simple type", () => {
  const type = types.frozen(types.number)
  assert(_ as TypeToData<typeof type>, _ as { $: number })

  const fr = frozen<number>(5)

  expectTypeCheckOk(type, fr)
  expectTypeCheckFail(type, 5, [], "{ $: number; }")
})

test("frozen - complex type", () => {
  const type = types.frozen(
    types.object(() => ({
      x: types.number,
    }))
  )
  assert(_ as TypeToData<typeof type>, _ as { $: { x: number } })

  const fr = frozen<{ x: number }>({ x: 5 })

  expectTypeCheckOk(type, fr)
  expectTypeCheckFail(type, 5, [], "{ $: { x: number; }; }")
})

test("enum (string)", () => {
  enum A {
    X1 = "x1",
    X2 = "x2",
  }
  assert(_ as TypeToData<typeof type>, _ as A)

  const type = types.enum<A>(A)

  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(type, "X1", [], `"x1" | "x2"`)
})

test("enum (number)", () => {
  enum A {
    X1,
    X2,
  }
  assert(_ as TypeToData<typeof type>, _ as A)

  const type = types.enum<A>(A)

  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(type, "X1", [], `0 | 1`)
})

test("enum (mixed)", () => {
  enum A {
    X1,
    X15 = "x15",
    X2 = 6,
  }
  assert(_ as TypeToData<typeof type>, _ as A)

  const type = types.enum<A>(A)

  expectTypeCheckOk(type, A.X15)
  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(type, "X1", [], `0 | "x15" | 6`)
})

test("integer", () => {
  const type = types.integer
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 5)
  expectTypeCheckFail(type, 5.5, [], "integer<number>")
})

test("nonEmptyString", () => {
  const type = types.nonEmptyString
  assert(_ as TypeToData<typeof type>, _ as string)

  expectTypeCheckOk(type, " ")
  expectTypeCheckFail(type, "", [], "nonEmpty<string>")
})

test("refinement (simple)", () => {
  const type = types.refinement(
    types.number,
    n => {
      return Number.isInteger(n)
    },
    "integer"
  )
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 5)
  expectTypeCheckFail(type, 5.5, [], "integer<number>")
})

test("refinement (complex)", () => {
  const sumObjType = types.object(() => ({
    a: types.number,
    b: types.number,
    result: types.number,
  }))

  const type = types.refinement(sumObjType, sum => {
    const rightResult = sum.a + sum.b === sum.result

    return rightResult ? null : new TypeCheckError(["result"], "a+b", sum.result)
  })
  assert(_ as TypeToData<typeof type>, _ as { b: number; a: number; result: number })

  expectTypeCheckOk(type, { a: 2, b: 3, result: 5 })
  expectTypeCheckFail(type, { a: 2, b: 3, result: 6 }, ["result"], "a+b")
})
