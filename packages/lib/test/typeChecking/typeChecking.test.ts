import { reaction } from "mobx"
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
    onFinish(ctx, result) {
      actions.push({ type: "finish", result, ctx })
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
  tsCheck<TypeToData<typeof type>>("hi")

  expectTypeCheckOk(type, "hi")
  expectTypeCheckFail(type, "ho", [], JSON.stringify("hi"))
})

test("undefined", () => {
  const type = types.undefined
  tsCheck<TypeToData<typeof type>>(undefined)

  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(type, "ho", [], "undefined")
})

test("null", () => {
  const type = types.null
  tsCheck<TypeToData<typeof type>>(null)

  expectTypeCheckOk(type, null)
  expectTypeCheckFail(type, "ho", [], "null")
})

test("boolean", () => {
  const type = types.boolean
  tsCheck<TypeToData<typeof type>>(true)

  expectTypeCheckOk(type, false)
  expectTypeCheckFail(type, "ho", [], "boolean")
})

test("number", () => {
  const type = types.number
  tsCheck<TypeToData<typeof type>>(5)

  expectTypeCheckOk(type, 6)
  expectTypeCheckFail(type, "ho", [], "number")
})

test("string", () => {
  const type = types.string
  tsCheck<TypeToData<typeof type>>("hi")

  expectTypeCheckOk(type, "hello")
  expectTypeCheckFail(type, 5, [], "string")
})

test("or - simple types", () => {
  const type = types.or(types.number, types.boolean)
  tsCheck<TypeToData<typeof type>>(5)
  tsCheck<TypeToData<typeof type>>(true)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, false)
  expectTypeCheckFail(type, "ho", [], "number | boolean")
})

test("maybe", () => {
  const type = types.maybe(types.number)
  tsCheck<TypeToData<typeof type>>(5)
  tsCheck<TypeToData<typeof type>>(undefined)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(type, "ho", [], "number | undefined")
})

test("maybeNull", () => {
  const type = types.maybeNull(types.number)
  tsCheck<TypeToData<typeof type>>(5)
  tsCheck<TypeToData<typeof type>>(null)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, null)
  expectTypeCheckFail(type, "ho", [], "number | null")
})

test("array - simple types", () => {
  const type = types.array(types.number)
  tsCheck<TypeToData<typeof type>>([5])

  expectTypeCheckOk(type, [])
  expectTypeCheckOk(type, [1, 2, 3])
  expectTypeCheckFail(type, "ho", [], "Array<number>")
  expectTypeCheckFail(type, ["ho"], [0], "number")
})

test("objectMap - simple types", () => {
  const type = types.objectMap(types.number)
  tsCheck<TypeToData<typeof type>>({ x: 5, y: 6 })

  expectTypeCheckOk(type, {})
  expectTypeCheckOk(type, { x: 5, y: 6 })
  expectTypeCheckFail(type, "ho", [], "ObjectMap<number>")
  const wrongValue = { x: 5, y: "6" }
  expectTypeCheckFail(type, wrongValue, ["y"], "number")
})

test("unchecked", () => {
  const type = types.unchecked<number>()
  tsCheck<TypeToData<typeof type>>(5)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, { x: 5, y: 6 } as any)
  expectTypeCheckOk(type, "ho" as any)
})

test("object - simple types", () => {
  const type = types.object(() => ({
    x: types.number,
    y: types.string,
  }))
  tsCheck<TypeToData<typeof type>>({ x: 5, y: "6" })

  expectTypeCheckOk(type, { x: 5, y: "6" })

  const expected = "{ x: number; y: string; }"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { x: 5, y: 6 }, ["y"], "string")
  expectTypeCheckFail(type, { x: 5, y: "6", z: 10 }, [], expected)
})

const mType = types.object(() => ({
  x: types.number,
  y: types.string,
}))

@model("M", { dataType: mType })
class M extends Model<TypeToData<typeof mType>> {
  defaultData = { x: 10 }

  @modelAction
  setX(v: number) {
    this.data.x = v
  }
}

test("model", () => {
  const m = newModel(M, { y: "6" })
  const type = types.model(M)
  tsCheck<TypeToData<typeof type>>(m)

  expectTypeCheckOk(type, m)
  expect(m.typeCheck()).toBeNull()

  expectTypeCheckFail(type, "ho", [], `Model(${m.modelType})`)
  expectTypeCheckFail(type, newModel(MR, {}), [], `Model(${m.modelType})`)
  m.setX("10" as any)
  expectTypeCheckFail(type, m, ["data", "x"], "number")
  expect(m.typeCheck()).toEqual(new TypeCheckError(["data", "x"], "number", "10"))
})

test("model typechecking", () => {
  const m = newModel(M, { y: "6" })
  const type = types.model(M)
  tsCheck<TypeToData<typeof type>>(m)

  expectTypeCheckOk(type, m)

  // make sure reaction doesn't run when we revert the change
  let reactionRun = 0
  autoDispose(
    reaction(
      () => m.data.x,
      () => {
        reactionRun++
      }
    )
  )

  expectTypeCheckError(m, () => {
    m.setX("5" as any)
  })
  expect(reactionRun).toBe(0)
  expect(m.data.x).toBe(10)
  expectTypeCheckOk(type, m)
})

test("newModel with typechecking enabled", () => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  expect(() => newModel(M, { x: 10, y: 20 as any })).toThrow(
    "TypeCheckError: [data/y] Expected: string"
  )
})

test("typedModel", () => {
  const m = newModel(M, { y: "6" })
  const type = types.typedModel<M>(M)
  tsCheck<TypeToData<typeof type>>(m)

  expectTypeCheckOk(type, m)

  expectTypeCheckFail(type, "ho", [], `Model(${m.modelType})`)
  m.setX("10" as any)
  expectTypeCheckFail(type, m, ["data", "x"], "number")
})

test("array - complex types", () => {
  const type = types.array(
    types.object(() => ({
      x: types.number,
    }))
  )
  tsCheck<TypeToData<typeof type>>([{ x: 5 }])

  expectTypeCheckOk(type, [{ x: 5 }])

  const expected = "Array<{ x: number; }>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, [5], [0], "{ x: number; }")
  expectTypeCheckFail(type, [{ x: "5" }], [0, "x"], "number")
})

test("array - unchecked", () => {
  const type = types.array(types.unchecked<number>())
  tsCheck<TypeToData<typeof type>>([1, 2, 3])

  expectTypeCheckOk(type, [1, 2, 3])

  const expected = "Array<any>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckOk(type, ["1"] as any)
})

test("object - complex types", () => {
  const type = types.object(() => ({
    x: types.number,
    o: types.object(() => ({
      y: types.string,
    })),
  }))
  tsCheck<TypeToData<typeof type>>({ x: 5, o: { y: "6" } })

  expectTypeCheckOk(type, { x: 5, o: { y: "6" } })

  const expected = "{ x: number; o: { y: string; }; }"
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
  tsCheck<TypeToData<typeof type>>({ o: { y: "6" } })

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
  tsCheck<TypeToData<typeof type>>({ y: "6" })
  tsCheck<TypeToData<typeof type>>(6)

  expectTypeCheckOk(type, { y: "6" })
  expectTypeCheckOk(type, 6)

  const expected = "{ y: string; } | number"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { y: 6 }, [], expected)
})

test("or - one type unchecked", () => {
  const type = types.or(types.number, types.boolean, types.unchecked())
  tsCheck<TypeToData<typeof type>>(5)
  tsCheck<TypeToData<typeof type>>(true)
  tsCheck<TypeToData<typeof type>>("hi")

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
  rec: types.maybe(types.typedModel<MR>(MR)),
}))

@model("MR", { dataType: mrType })
class MR extends Model<TypeToData<typeof mrType>> {
  defaultData = {
    x: 10,
    rec: undefined,
  }

  @modelAction
  setRec(r: MR | undefined) {
    this.data.rec = r
  }
}

test("recursive model", () => {
  const type = types.model(MR)

  const mr = newModel(MR, { rec: newModel(MR, {}) })
  tsCheck<TypeToData<typeof type>>(mr)

  expectTypeCheckOk(type, mr)

  mr.setRec("5" as any)
  expectTypeCheckFail(type, mr, ["data", "rec"], "Model(MR) | undefined")
})

const maType = types.object(() => ({
  x: types.number,
  b: types.maybe(types.typedModel<MB>(MB)),
}))

@model("MA", { dataType: maType })
class MA extends Model<TypeToData<typeof maType>> {
  defaultData = {
    x: 10,
    b: undefined,
  }

  @modelAction
  setB(r: MB | undefined) {
    this.data.b = r
  }
}

const mbType = types.object(() => ({
  y: types.number,
  a: types.maybe(types.typedModel<MA>(MA)),
}))

@model("MB", { dataType: mbType })
class MB extends Model<TypeToData<typeof mbType>> {
  defaultData = {
    y: 20,
    a: undefined,
  }

  @modelAction
  setA(r: MA | undefined) {
    this.data.a = r
  }
}

test("cross referenced model", () => {
  const type = types.model(MA)

  const ma = newModel(MA, { b: newModel(MB, { a: newModel(MA, {}) }) })
  tsCheck<TypeToData<typeof type>>(ma)

  expectTypeCheckOk(type, ma)

  ma.data.b!.setA("5" as any)
  expectTypeCheckFail(type, ma, ["data", "b"], "Model(MB) | undefined")
})

test("ref", () => {
  const type = types.ref<M>()

  const m = newModel(M, { y: "6" })
  const r = ref(m)
  tsCheck<TypeToData<typeof type>>(r)

  expectTypeCheckOk(type, r)
  expectTypeCheckFail(type, m, [], "Model($$Ref)")
})

test("frozen - simple type", () => {
  const type = types.frozen(types.number)

  const fr = frozen<number>(5)
  tsCheck<TypeToData<typeof type>>(fr)

  expectTypeCheckOk(type, fr)
  expectTypeCheckFail(type, 5, [], "{ data: number; }")
})

test("frozen - complex type", () => {
  const type = types.frozen(
    types.object(() => ({
      x: types.number,
    }))
  )

  const fr = frozen<{ x: number }>({ x: 5 })
  tsCheck<TypeToData<typeof type>>(fr)

  expectTypeCheckOk(type, fr)
  expectTypeCheckFail(type, 5, [], "{ data: { x: number; }; }")
})

// just to see TS typing is ok
/*
const mdata = types.object(() => ({
  x: types.number,
  recursive: types.maybe(types.typedModel<M>(M)),
}))

class M extends Model<SchemaToType<typeof mdata>> {}

const m = newModel(M, { x: 6, recursive: undefined })
m.data.x
m.data.recursive!.data.x

class M2 extends Model<{ yyy: number }> {}

const nodeType = types.object(() => ({
  x: types.number,
  self: nodeType,
  other: otherType,
  arr: types.array(nodeType),
  objMap: types.objectMap(nodeType),
  hiLiteral: types.literal("hi"),
  hiOrBye: types.or(types.literal("hi"), types.literal("bye")),
  nodeOrOther: types.or(nodeType, otherType),
  mod: types.maybe(types.model(M2)),
}))

const otherType = () => ({
  x: types.number,
  y: types.string,
  cross: nodeType,
})

type ntt = SchemaToType<typeof nodeType>
const a: ntt = undefined as any
a.self.self.other.cross.self.x
a.self.other.cross.other.y
a.arr[0].x
a.objMap["a"].hiLiteral
a.hiOrBye
a.nodeOrOther.x // number
a.mod!.data.yyy
*/
