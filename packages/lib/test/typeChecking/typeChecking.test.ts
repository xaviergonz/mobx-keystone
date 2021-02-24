import { computed, reaction } from "mobx"
import { assert, _ } from "spec.ts"
import {
  actionTrackingMiddleware,
  AnyModel,
  AnyType,
  ArraySet,
  arraySet,
  ArraySetTypeInfo,
  ArrayTypeInfo,
  BooleanTypeInfo,
  createTypeCheckError,
  customRef,
  frozen,
  FrozenTypeInfo,
  getTypeInfo,
  getValidationResult,
  LiteralTypeInfo,
  mergeTypeCheckErrors,
  model,
  Model,
  modelAction,
  ModelAutoTypeCheckingMode,
  modelIdKey,
  ModelTypeInfo,
  ModelTypeInfoProps,
  NumberTypeInfo,
  ObjectMap,
  objectMap,
  ObjectMapTypeInfo,
  ObjectTypeInfo,
  ObjectTypeInfoProps,
  onPatches,
  onSnapshot,
  OrTypeInfo,
  Path,
  prop,
  RecordTypeInfo,
  Ref,
  RefinementTypeInfo,
  RefTypeInfo,
  resolvePath,
  setGlobalConfig,
  StringTypeInfo,
  tProp,
  TupleTypeInfo,
  typeCheck,
  TypeCheckErrors,
  TypeInfo,
  types,
  TypeToData,
  UncheckedTypeInfo,
} from "../../src"
import { resolveStandardType } from "../../src/typeChecking/resolveTypeChecker"
import "../commonSetup"
import { autoDispose } from "../utils"

beforeEach(() => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
  })
})

function expectTypeCheckError(m: AnyModel, fn: () => void) {
  const snapshots: any[] = []
  const disposer1 = onSnapshot(m, (sn) => {
    snapshots.push(sn)
  })
  const patches: any[] = []
  const disposer2 = onPatches(m, (p) => {
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

function expectTypeCheckFail<T extends AnyType>(t: T, val: any, errors: TypeCheckErrors): void
function expectTypeCheckFail<T extends AnyType>(t: T, val: any, path: Path, expected: string): void
function expectTypeCheckFail<T extends AnyType>(
  t: T,
  val: any,
  ...errorInfo: [TypeCheckErrors] | [Path, string]
): void {
  const err = typeCheck(t, val)
  if (errorInfo.length === 1) {
    const [errors] = errorInfo
    expect(err).toEqual(errors)
  } else {
    const [path, expected] = errorInfo
    const { value: actualValue } = resolvePath(val, path, true)
    expect(err).toEqual(createTypeCheckError(path, expected, actualValue))
  }
}

function expectValidTypeInfo<TI extends TypeInfo>(
  type: AnyType,
  ti: new (...args: any[]) => TI
): TI {
  const typeInfo = getTypeInfo(type) as TI
  expect(typeInfo).toBe(getTypeInfo(type)) // always return same object
  expect(typeInfo).toBeInstanceOf(ti)
  expect(typeInfo.thisType).toBe(resolveStandardType(type))
  return typeInfo
}

test("literal", () => {
  const type = types.literal("hi")
  assert(_ as TypeToData<typeof type>, "hi")

  expectTypeCheckOk(type, "hi")
  expectTypeCheckFail(type, "ho", [], JSON.stringify("hi"))

  const typeInfo = getTypeInfo(type) as LiteralTypeInfo
  expect(typeInfo).toBe(getTypeInfo(type)) // always return same object
  expect(typeInfo).toBeInstanceOf(LiteralTypeInfo)
  expect(typeInfo.thisType).toBe(type)
  expect(typeInfo.literal).toBe("hi")
})

test("undefined", () => {
  const type = types.undefined
  assert(_ as TypeToData<typeof type>, undefined)

  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(type, "ho", [], "undefined")

  const typeInfo = expectValidTypeInfo(type, LiteralTypeInfo)
  expect(typeInfo.literal).toBe(undefined)
})

test("simple undefined", () => {
  const type = undefined
  assert(_ as TypeToData<typeof type>, undefined)

  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(type, "ho", [], "undefined")

  const typeInfo = expectValidTypeInfo(type, LiteralTypeInfo)
  expect(typeInfo.literal).toBe(undefined)
})

test("null", () => {
  const type = types.null
  assert(_ as TypeToData<typeof type>, null)

  expectTypeCheckOk(type, null)
  expectTypeCheckFail(type, "ho", [], "null")

  const typeInfo = expectValidTypeInfo(type, LiteralTypeInfo)
  expect(typeInfo.literal).toBe(null)
})

test("simple null", () => {
  const type = null
  assert(_ as TypeToData<typeof type>, null)

  expectTypeCheckOk(type, null)
  expectTypeCheckFail(type, "ho", [], "null")

  const typeInfo = expectValidTypeInfo(type, LiteralTypeInfo)
  expect(typeInfo.literal).toBe(null)
})

test("boolean", () => {
  const type = types.boolean
  assert(_ as TypeToData<typeof type>, _ as boolean)

  expectTypeCheckOk(type, false)
  expectTypeCheckFail(type, "ho", [], "boolean")

  expectValidTypeInfo(type, BooleanTypeInfo)
})

test("simple boolean", () => {
  const type = Boolean
  assert(_ as TypeToData<typeof type>, _ as boolean)

  expectTypeCheckOk(type, false)
  expectTypeCheckFail(type, "ho", [], "boolean")

  expectValidTypeInfo(type, BooleanTypeInfo)
})

test("number", () => {
  const type = types.number
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 6)
  expectTypeCheckFail(type, "ho", [], "number")

  expectValidTypeInfo(type, NumberTypeInfo)
})

test("simple number", () => {
  const type = Number
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 6)
  expectTypeCheckFail(type, "ho", [], "number")

  expectValidTypeInfo(type, NumberTypeInfo)
})

test("string", () => {
  const type = types.string
  assert(_ as TypeToData<typeof type>, _ as string)

  expectTypeCheckOk(type, "hello")
  expectTypeCheckFail(type, 5, [], "string")

  expectValidTypeInfo(type, StringTypeInfo)
})

test("simple string", () => {
  const type = String
  assert(_ as TypeToData<typeof type>, _ as string)

  expectTypeCheckOk(type, "hello")
  expectTypeCheckFail(type, 5, [], "string")

  expectValidTypeInfo(type, StringTypeInfo)
})

test("or - simple types", () => {
  const type = types.or(types.number, types.boolean)
  assert(_ as TypeToData<typeof type>, _ as number | boolean)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, false)
  expectTypeCheckFail(
    type,
    "ho",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], "number", "ho"),
      createTypeCheckError([], "boolean", "ho"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([types.number, types.boolean])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.boolean)])
})

test("or - simple simple types", () => {
  const type = types.or(Number, Boolean)
  assert(_ as TypeToData<typeof type>, _ as number | boolean)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, false)
  expectTypeCheckFail(
    type,
    "ho",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], "number", "ho"),
      createTypeCheckError([], "boolean", "ho"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([types.number, types.boolean])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.boolean)])
})

test("maybe", () => {
  const type = types.maybe(types.number)
  assert(_ as TypeToData<typeof type>, _ as number | undefined)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(
    type,
    "ho",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], "number", "ho"),
      createTypeCheckError([], "undefined", "ho"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([types.number, types.undefined])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.undefined)])
})

test("maybeNull", () => {
  const type = types.maybeNull(types.number)
  assert(_ as TypeToData<typeof type>, _ as number | null)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, null)
  expectTypeCheckFail(
    type,
    "ho",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], "number", "ho"),
      createTypeCheckError([], "null", "ho"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([types.number, types.null])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.null)])
})

test("array - simple types", () => {
  const type = types.array(types.number)
  assert(_ as TypeToData<typeof type>, _ as number[])

  expectTypeCheckOk(type, [])
  expectTypeCheckOk(type, [1, 2, 3])
  expectTypeCheckFail(type, "ho", [], "Array<number>")
  expectTypeCheckFail(type, ["ho"], [0], "number")

  const typeInfo = expectValidTypeInfo(type, ArrayTypeInfo)
  expect(typeInfo.itemType).toEqual(types.number)
  expect(typeInfo.itemTypeInfo).toEqual(getTypeInfo(types.number))
})

test("tuple - simple types", () => {
  const type = types.tuple(types.number, types.string)
  assert(_ as TypeToData<typeof type>, _ as [number, string])

  expectTypeCheckOk(type, [1, "str1"])
  expectTypeCheckOk(type, [2, "str2"])
  expectTypeCheckFail(type, "ho", [], "[number, string]")
  expectTypeCheckFail(type, [1, 2], [1], "string")

  const typeInfo = expectValidTypeInfo(type, TupleTypeInfo)
  expect(typeInfo.itemTypes).toEqual([types.number, types.string])
  expect(typeInfo.itemTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.string)])
})

test("record - simple types", () => {
  const type = types.record(types.number)
  assert(_ as TypeToData<typeof type>, _ as { [k: string]: number })

  expectTypeCheckOk(type, {})
  expectTypeCheckOk(type, { x: 5, y: 6 })
  expectTypeCheckFail(type, "ho", [], "Record<number>")
  const wrongValue = { x: 5, y: "6" }
  expectTypeCheckFail(type, wrongValue, ["y"], "number")

  const typeInfo = expectValidTypeInfo(type, RecordTypeInfo)
  expect(typeInfo.valueType).toEqual(types.number)
  expect(typeInfo.valueTypeInfo).toEqual(getTypeInfo(types.number))
})

test("unchecked", () => {
  const type = types.unchecked<number>()
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, { x: 5, y: 6 } as any)
  expectTypeCheckOk(type, "ho" as any)

  expectValidTypeInfo(type, UncheckedTypeInfo)
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
  // excess properties are allowed
  expectTypeCheckOk(type, { x: 5, y: "6", z: 10 } as any)

  const typeInfo = expectValidTypeInfo(type, ObjectTypeInfo)
  expect(typeInfo.props).toBe(typeInfo.props) // always return same object
  expect(typeInfo.props).toStrictEqual({
    x: {
      type: types.number,
      typeInfo: getTypeInfo(types.number),
    },
    y: {
      type: types.string,
      typeInfo: getTypeInfo(types.string),
    },
  } as ObjectTypeInfoProps)
})

test("object - all optional simple types", () => {
  const xType = types.maybe(types.number)
  const yType = types.maybe(types.string)

  const type = types.object(() => ({
    x: xType,
    y: yType,
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
  expectTypeCheckFail(
    type,
    { x: 5, y: 6 },
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["y"], "string", 6),
      createTypeCheckError(["y"], "undefined", 6),
    ])
  )
  // excess properties are allowed
  expectTypeCheckOk(type, { x: 5, y: "6" })

  const typeInfo = expectValidTypeInfo(type, ObjectTypeInfo)
  expect(typeInfo.props).toBe(typeInfo.props) // always return same object
  expect(typeInfo.props).toStrictEqual({
    x: {
      type: xType,
      typeInfo: getTypeInfo(xType),
    },
    y: {
      type: yType,
      typeInfo: getTypeInfo(yType),
    },
  } as ObjectTypeInfoProps)
})

const mArrType = types.array(types.number)
const mArrDefault = () => []

@model("M")
class M extends Model({
  x: tProp(types.number, 10),
  y: tProp(types.string),
  arr: tProp(mArrType, mArrDefault),
  untyped: prop(5),
}) {
  @modelAction
  setX(v: number) {
    this.x = v
  }

  @modelAction
  setArr(v: number[]) {
    this.arr = v
  }

  @modelAction
  addArr(v: number) {
    this.arr.push(v)
  }
}

test("model", () => {
  const m = new M({ y: "6" })
  const type = types.model<M>(M)
  assert(_ as TypeToData<typeof type>, _ as M)

  expectTypeCheckOk(type, m)
  expect(m.typeCheck()).toBeNull()

  expectTypeCheckFail(type, "ho", [], `Model(${m.$modelType})`)
  expectTypeCheckFail(type, new MR({}), [], `Model(${m.$modelType})`)
  m.setX("10" as any)
  expectTypeCheckFail(type, m, ["$", "x"], "number")
  expect(m.typeCheck()).toEqual(createTypeCheckError(["$", "x"], "number", "10"))

  const typeInfo = expectValidTypeInfo(type, ModelTypeInfo)
  expect(typeInfo.modelClass).toBe(M)
  expect(typeInfo.modelType).toBe("M")
  expect(typeInfo.props).toBe(typeInfo.props) // always return same object
  expect(typeInfo.props).toStrictEqual({
    x: {
      type: types.number,
      typeInfo: getTypeInfo(types.number),
      hasDefault: true,
      default: 10,
    },
    y: {
      type: types.string,
      typeInfo: getTypeInfo(types.string),
      hasDefault: false,
      default: undefined,
    },
    [modelIdKey]: {
      type: types.string,
      typeInfo: getTypeInfo(types.string),
      hasDefault: true,
      default: typeInfo.props[modelIdKey].default,
    },
    arr: {
      type: mArrType,
      typeInfo: getTypeInfo(mArrType),
      hasDefault: true,
      default: mArrDefault,
    },
    untyped: {
      type: undefined,
      typeInfo: undefined,
      hasDefault: true,
      default: 5,
    },
  } as ModelTypeInfoProps)
})

test("model typechecking", () => {
  const m = new M({ y: "6" })
  const type = types.model<M>(M)
  assert(_ as TypeToData<typeof type>, _ as M)

  expectTypeCheckOk(type, m)

  // make sure reaction doesn't run when we revert the change
  let reactionRun = 0
  autoDispose(
    reaction(
      () => m.x,
      () => {
        reactionRun++
      }
    )
  )

  expectTypeCheckError(m, () => {
    m.setX("5" as any)
  })
  expect(reactionRun).toBe(0)
  expect(m.x).toBe(10)
  expectTypeCheckOk(type, m)

  // complex object
  expectTypeCheckError(m, () => {
    m.setArr([1, 2, "3" as any])
  })
  expect(m.arr).toEqual([])

  m.setArr([1, 2])
  expect(m.arr).toEqual([1, 2])

  expectTypeCheckError(m, () => {
    m.addArr("3" as any)
  })
  expect(m.arr).toEqual([1, 2])
})

test("new model with typechecking enabled", () => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  expect(() => new M({ x: 10, y: 20 as any })).toThrow("TypeCheckError: [/$/y] Expected: string")
})

test("array - complex types", () => {
  const itemType = types.object(() => ({
    x: types.number,
  }))
  const type = types.array(itemType)
  assert(_ as TypeToData<typeof type>, _ as { x: number }[])

  expectTypeCheckOk(type, [{ x: 5 }])

  const expected = "Array<{ x: number; }>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, [5], [0], "{ x: number; }")
  expectTypeCheckFail(type, [{ x: "5" }], [0, "x"], "number")

  const typeInfo = expectValidTypeInfo(type, ArrayTypeInfo)
  expect(typeInfo.itemType).toEqual(itemType)
  expect(typeInfo.itemTypeInfo).toEqual(getTypeInfo(itemType))
})

test("array - unchecked", () => {
  const type = types.array(types.unchecked<number>())
  assert(_ as TypeToData<typeof type>, _ as number[])

  expectTypeCheckOk(type, [1, 2, 3])

  const expected = "Array<any>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckOk(type, ["1"] as any)

  const typeInfo = expectValidTypeInfo(type, ArrayTypeInfo)
  expect(typeInfo.itemType).toEqual(types.unchecked())
  expect(typeInfo.itemTypeInfo).toEqual(getTypeInfo(types.unchecked()))
})

test("array - undefined", () => {
  const type = types.array(types.undefined)
  assert(_ as TypeToData<typeof type>, _ as undefined[])

  expectTypeCheckOk(type, [undefined])

  expectTypeCheckFail(type, "ho", [], "Array<undefined>")
  expectTypeCheckFail(type, ["ho"], [0], "undefined")

  const typeInfo = expectValidTypeInfo(type, ArrayTypeInfo)
  expect(typeInfo.itemType).toEqual(types.undefined)
  expect(typeInfo.itemTypeInfo).toEqual(getTypeInfo(types.undefined))
})

test("array - multiple errors", () => {
  const type = types.array(types.number)
  expectTypeCheckFail(
    type,
    ["1", true],
    mergeTypeCheckErrors("and", [
      createTypeCheckError([0], "number", "1"),
      createTypeCheckError([1], "number", true),
    ])
  )
})

test("tuple - multiple errors", () => {
  const type = types.tuple(types.number, types.string)
  expectTypeCheckFail(
    type,
    ["1", 1],
    mergeTypeCheckErrors("and", [
      createTypeCheckError([0], "number", "1"),
      createTypeCheckError([1], "string", 1),
    ])
  )
})

test("object - complex types", () => {
  const xType = types.maybe(types.number)
  const oType = types.object(() => ({
    y: types.string,
  }))

  const type = types.object(() => ({
    x: xType,
    o: oType,
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
  // excess properties are ok
  expectTypeCheckOk(type, { x: 5, o: { y: "6" }, z: 10 } as any)
  expectTypeCheckFail(type, { x: 5, o: { y: 6 } }, ["o", "y"], "string")

  const typeInfo = expectValidTypeInfo(type, ObjectTypeInfo)
  expect(typeInfo.props).toBe(typeInfo.props) // always return same object
  expect(typeInfo.props).toStrictEqual({
    x: {
      type: xType,
      typeInfo: getTypeInfo(xType),
    },
    o: {
      type: oType,
      typeInfo: getTypeInfo(oType),
    },
  } as ObjectTypeInfoProps)
})

test("object - multiple errors", () => {
  const type = types.object(() => ({ x: types.number, y: types.number }))
  expectTypeCheckFail(
    type,
    { x: "1", y: true },
    mergeTypeCheckErrors("and", [
      createTypeCheckError(["x"], "number", "1"),
      createTypeCheckError(["y"], "number", true),
    ])
  )
})

test("record - complex types", () => {
  const valueType = types.object(() => ({
    y: types.string,
  }))

  const type = types.record(valueType)
  assert(_ as TypeToData<typeof type>, _ as { [k: string]: { y: string } })

  expectTypeCheckOk(type, { o: { y: "6" } })

  const expected = "Record<{ y: string; }>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { o: 6 }, ["o"], "{ y: string; }")
  expectTypeCheckFail(type, { o: { y: 6 } }, ["o", "y"], "string")

  const typeInfo = expectValidTypeInfo(type, RecordTypeInfo)
  expect(typeInfo.valueType).toEqual(valueType)
  expect(typeInfo.valueTypeInfo).toEqual(getTypeInfo(valueType))
})

test("record - multiple errors", () => {
  const type = types.record(types.number)
  expectTypeCheckFail(
    type,
    { x: "1", y: true },
    mergeTypeCheckErrors("and", [
      createTypeCheckError(["x"], "number", "1"),
      createTypeCheckError(["y"], "number", true),
    ])
  )
})

test("or - complex types", () => {
  const typeA = types.object(() => ({
    y: types.string,
  }))
  const typeB = types.number

  const type = types.or(typeA, typeB)
  assert(_ as TypeToData<typeof type>, _ as number | { y: string })

  expectTypeCheckOk(type, { y: "6" })
  expectTypeCheckOk(type, 6)

  expectTypeCheckFail(
    type,
    "ho",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], "{ y: string; }", "ho"),
      createTypeCheckError([], "number", "ho"),
    ])
  )
  expectTypeCheckFail(
    type,
    { y: 6 },
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["y"], "string", 6),
      createTypeCheckError([], "number", { y: 6 }),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([typeA, typeB])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(typeA), getTypeInfo(typeB)])
})

test("or - one type unchecked", () => {
  const typeA = types.number
  const typeB = types.boolean
  const typeC = types.unchecked<string>()

  const type = types.or(typeA, typeB, typeC)
  assert(_ as TypeToData<typeof type>, _ as string | number | boolean)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, false)
  expectTypeCheckOk(type, "ho")

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([typeA, typeB, typeC])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(typeA), getTypeInfo(typeB), getTypeInfo(typeC)])
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
    { x: 5, rec: "ho" },
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["rec"], "{ x: number; rec: ... | undefined; }", "ho"),
      createTypeCheckError(["rec"], "undefined", "ho"),
    ])
  )
  expectTypeCheckFail(
    type,
    { x: 5, rec: { x: "6" } },
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["rec", "x"], "number", "6"),
      createTypeCheckError(["rec"], "undefined", { x: "6" }),
      // won't say anything about the missing nested `rec` because of the `or` (`maybe`) type
    ])
  )

  const typeInfo = expectValidTypeInfo(type, ObjectTypeInfo)
  expect(typeInfo.props).toBe(typeInfo.props) // always return same object
  expect(typeInfo.props.x).toStrictEqual({
    type: types.number,
    typeInfo: getTypeInfo(types.number),
  })
  const recTypeInfo = expectValidTypeInfo(typeInfo.props.rec.type, OrTypeInfo)
  expect(recTypeInfo.orTypes[0]).toBe(type)
  expect(recTypeInfo.orTypeInfos[0]).toBe(typeInfo)
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
    "ho",
    [],
    "{ x: number; b: { y: number; a: ... | undefined; } | undefined; }"
  )
  expectTypeCheckFail(
    typeA,
    { x: 5, b: "ho" },
    mergeTypeCheckErrors("or", [
      createTypeCheckError(
        ["b"],
        "{ y: number; a: { x: number; b: ... | undefined; } | undefined; }",
        "ho"
      ),
      createTypeCheckError(["b"], "undefined", "ho"),
    ])
  )
  expectTypeCheckFail(
    typeA,
    { x: 5, b: { y: "6", a: undefined } },
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["b", "y"], "number", "6"),
      createTypeCheckError(["b"], "undefined", { y: "6", a: undefined }),
    ])
  )

  {
    const typeInfo = expectValidTypeInfo(typeA, ObjectTypeInfo)
    expect(typeInfo.props).toBe(typeInfo.props) // always return same object
    expect(typeInfo.props.x).toStrictEqual({
      type: types.number,
      typeInfo: getTypeInfo(types.number),
    })
    const propTypeInfo = expectValidTypeInfo(typeInfo.props.b.type, OrTypeInfo)
    expect(propTypeInfo.orTypes[0]).toBe(typeB)
    expect(propTypeInfo.orTypeInfos[0]).toBe(getTypeInfo(typeB))
  }

  {
    const typeInfo = expectValidTypeInfo(typeB, ObjectTypeInfo)
    expect(typeInfo.props).toBe(typeInfo.props) // always return same object
    expect(typeInfo.props.y).toStrictEqual({
      type: types.number,
      typeInfo: getTypeInfo(types.number),
    })
    const propTypeInfo = expectValidTypeInfo(typeInfo.props.a.type, OrTypeInfo)
    expect(propTypeInfo.orTypes[0]).toBe(typeA)
    expect(propTypeInfo.orTypeInfos[0]).toBe(getTypeInfo(typeA))
  }
})

@model("MR")
class MR extends Model({
  x: tProp(types.number, 10),
  rec: tProp(types.maybe(types.model<MR>(() => MR))),
}) {
  @modelAction
  setRec(r: MR | undefined) {
    this.rec = r
  }
}

test("recursive model", () => {
  const type = types.model<MR>(MR)

  const mr = new MR({ rec: new MR({}) })
  assert(_ as TypeToData<typeof type>, _ as MR)

  expectTypeCheckOk(type, mr)

  mr.setRec("5" as any)
  expectTypeCheckFail(
    type,
    mr,
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["$", "rec"], "Model(MR)", "5"),
      createTypeCheckError(["$", "rec"], "undefined", "5"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, ModelTypeInfo)
  expect(typeInfo.modelClass).toBe(MR)
  expect(typeInfo.modelType).toBe("MR")
  expect(typeInfo.props).toBe(typeInfo.props) // always return same object
  expect(typeInfo.props.x).toStrictEqual({
    type: types.number,
    typeInfo: getTypeInfo(types.number),
    hasDefault: true,
    default: 10,
  })
  const recTypeInfo = expectValidTypeInfo(typeInfo.props.rec.type, OrTypeInfo)
  const recModelTypeInfo = expectValidTypeInfo(recTypeInfo.orTypes[0], ModelTypeInfo)
  expect(recModelTypeInfo.modelClass).toBe(MR)
  expect(recModelTypeInfo.modelType).toBe("MR")
  expect(recModelTypeInfo.props.rec).toBeDefined()
})

@model("MA")
class MA extends Model({
  x: tProp(types.number, 10),
  b: tProp(types.maybe(types.model<MB>(() => MB))),
}) {
  @modelAction
  setB(r: MB | undefined) {
    this.b = r
  }
}

@model("MB")
class MB extends Model({
  y: tProp(types.number, 20),
  a: tProp(types.maybe(types.model<MA>(MA))),
}) {
  @modelAction
  setA(r: MA | undefined) {
    this.a = r
  }
}

test("cross referenced model", () => {
  const type = types.model<MA>(MA)

  const ma = new MA({ b: new MB({ a: new MA({}) }) })
  assert(_ as TypeToData<typeof type>, _ as MA)

  expectTypeCheckOk(type, ma)

  ma.b!.setA("5" as any)
  expectTypeCheckFail(
    type,
    ma,
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["$", "b", "$", "a"], "Model(MA)", "5"),
      createTypeCheckError(["$", "b", "$", "a"], "undefined", "5"),
      createTypeCheckError(["$", "b"], "undefined", ma.b!),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, ModelTypeInfo)
  expect(typeInfo.modelClass).toBe(MA)
  expect(typeInfo.modelType).toBe("MA")
  expect(typeInfo.props).toBe(typeInfo.props) // always return same object
  expect(typeInfo.props.x).toStrictEqual({
    type: types.number,
    typeInfo: getTypeInfo(types.number),
    hasDefault: true,
    default: 10,
  })
  const recTypeInfo = expectValidTypeInfo(typeInfo.props.b.type, OrTypeInfo)
  const recModelTypeInfo = expectValidTypeInfo(recTypeInfo.orTypes[0], ModelTypeInfo)
  expect(recModelTypeInfo.modelClass).toBe(MB)
  expect(recModelTypeInfo.modelType).toBe("MB")
  expect(recModelTypeInfo.props.a).toBeDefined()
})

test("ref", () => {
  const type = types.ref<M>()

  const m = new M({ y: "6" })
  const customR = customRef<M>("customRefM", {
    resolve() {
      return m
    },
    getId(target) {
      return "" + target.y
    },
  })
  const r = customR(m)
  assert(_ as TypeToData<typeof type>, _ as Ref<M>)

  expectTypeCheckOk(type, r)
  expectTypeCheckFail(type, m, [], "Ref")

  expectValidTypeInfo(type, RefTypeInfo)
})

test("frozen - simple type", () => {
  const type = types.frozen(types.number)
  assert(_ as TypeToData<typeof type>, _ as { data: number })

  const fr = frozen<number>(5)

  expectTypeCheckOk(type, fr)
  expectTypeCheckFail(type, 5, [], "{ data: number; }")

  const typeInfo = expectValidTypeInfo(type, FrozenTypeInfo)
  expect(typeInfo.dataType).toBe(types.number)
  expect(typeInfo.dataTypeInfo).toBe(getTypeInfo(types.number))
})

test("frozen - complex type", () => {
  const dataType = types.object(() => ({
    x: types.number,
  }))

  const type = types.frozen(dataType)
  assert(_ as TypeToData<typeof type>, _ as { data: { x: number } })

  const fr = frozen<{ x: number }>({ x: 5 })

  expectTypeCheckOk(type, fr)
  expectTypeCheckFail(type, 5, [], "{ data: { x: number; }; }")

  const typeInfo = expectValidTypeInfo(type, FrozenTypeInfo)
  expect(typeInfo.dataType).toBe(dataType)
  expect(typeInfo.dataTypeInfo).toBe(getTypeInfo(dataType))
})

test("enum (string)", () => {
  enum A {
    X1 = "x1",
    X2 = "x2",
  }

  const type = types.enum(A)

  assert(_ as TypeToData<typeof type>, _ as A)

  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(
    type,
    "X1",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], `"x1"`, "X1"),
      createTypeCheckError([], `"x2"`, "X1"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypeInfos).toHaveLength(2)
  const orA = typeInfo.orTypeInfos[0] as LiteralTypeInfo
  expect(orA).toBeInstanceOf(LiteralTypeInfo)
  expect(orA.literal).toBe(A.X1)
  const orB = typeInfo.orTypeInfos[1] as LiteralTypeInfo
  expect(orB).toBeInstanceOf(LiteralTypeInfo)
  expect(orB.literal).toBe(A.X2)
})

test("enum (number)", () => {
  enum A {
    X1,
    X2,
  }

  const type = types.enum(A)

  assert(_ as TypeToData<typeof type>, _ as A)

  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(
    type,
    "X1",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], "0", "X1"),
      createTypeCheckError([], "1", "X1"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypeInfos).toHaveLength(2)
  const orA = typeInfo.orTypeInfos[0] as LiteralTypeInfo
  expect(orA).toBeInstanceOf(LiteralTypeInfo)
  expect(orA.literal).toBe(A.X1)
  const orB = typeInfo.orTypeInfos[1] as LiteralTypeInfo
  expect(orB).toBeInstanceOf(LiteralTypeInfo)
  expect(orB.literal).toBe(A.X2)
})

test("enum (mixed)", () => {
  enum A {
    X1,
    X15 = "x15",
    X2 = 6,
  }

  const type = types.enum(A)

  assert(_ as TypeToData<typeof type>, _ as A)

  expectTypeCheckOk(type, A.X15)
  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(
    type,
    "X1",
    mergeTypeCheckErrors("or", [
      createTypeCheckError([], "0", "X1"),
      createTypeCheckError([], `"x15"`, "X1"),
      createTypeCheckError([], "6", "X1"),
    ])
  )

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypeInfos).toHaveLength(3)
  const orA = typeInfo.orTypeInfos[0] as LiteralTypeInfo
  expect(orA).toBeInstanceOf(LiteralTypeInfo)
  expect(orA.literal).toBe(A.X1)
  const orB = typeInfo.orTypeInfos[1] as LiteralTypeInfo
  expect(orB).toBeInstanceOf(LiteralTypeInfo)
  expect(orB.literal).toBe(A.X15)
  const orC = typeInfo.orTypeInfos[2] as LiteralTypeInfo
  expect(orC).toBeInstanceOf(LiteralTypeInfo)
  expect(orC.literal).toBe(A.X2)
})

test("integer", () => {
  const type = types.integer
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 5)
  expectTypeCheckFail(type, 5.5, [], "integer<number>")

  // no type info test, it is a refinement
})

test("nonEmptyString", () => {
  const type = types.nonEmptyString
  assert(_ as TypeToData<typeof type>, _ as string)

  expectTypeCheckOk(type, " ")
  expectTypeCheckFail(type, "", [], "nonEmpty<string>")

  // no type info test, it is a refinement
})

test("refinement (simple)", () => {
  const checkFn = (n: number) => {
    return Number.isInteger(n)
  }

  const type = types.refinement(types.number, checkFn, "integer")
  assert(_ as TypeToData<typeof type>, _ as number)

  expectTypeCheckOk(type, 5)
  expectTypeCheckFail(type, 5.5, [], "integer<number>")

  const typeInfo = expectValidTypeInfo(type, RefinementTypeInfo)
  expect(typeInfo.baseType).toBe(types.number)
  expect(typeInfo.baseTypeInfo).toBe(getTypeInfo(types.number))
  expect(typeInfo.checkFunction).toBe(checkFn)
  expect(typeInfo.typeName).toBe("integer")
})

test("refinement (simple child)", () => {
  const checkFn = (n: number) => {
    return Number.isInteger(n)
  }

  const type = types.object(() => ({ value: types.refinement(types.number, checkFn, "integer") }))

  expectTypeCheckOk(type, { value: 5 })
  expectTypeCheckFail(type, { value: 5.5 }, ["value"], "integer<number>")
})

test("refinement (complex)", () => {
  const sumObjType = types.object(() => ({
    a: types.number,
    b: types.number,
    result: types.number,
  }))

  const type = types.refinement(sumObjType, (sum) => {
    const rightResult = sum.a + sum.b === sum.result

    return rightResult ? null : createTypeCheckError(["result"], "a+b", sum.result)
  })
  assert(_ as TypeToData<typeof type>, _ as { b: number; a: number; result: number })

  expectTypeCheckOk(type, { a: 2, b: 3, result: 5 })
  expectTypeCheckFail(type, { a: 2, b: 3, result: 6 }, ["result"], "a+b")

  const typeInfo = expectValidTypeInfo(type, RefinementTypeInfo)
  expect(typeInfo.typeName).toBe(undefined)
})

test("objectMap", () => {
  const type = types.objectMap(types.number)

  assert(_ as TypeToData<typeof type>, _ as ObjectMap<number>)

  expectTypeCheckOk(
    type,
    objectMap<number>([["1", 10]])
  )
  expectTypeCheckFail(
    type,
    objectMap<string>([["1", "10"]]),
    ["items", "1"],
    "number"
  )

  const typeInfo = expectValidTypeInfo(type, ObjectMapTypeInfo)
  expect(typeInfo.valueType).toBe(types.number)
  expect(typeInfo.valueTypeInfo).toBe(getTypeInfo(types.number))
})

test("arraySet", () => {
  const type = types.arraySet(types.number)

  assert(_ as TypeToData<typeof type>, _ as ArraySet<number>)

  expectTypeCheckOk(
    type,
    arraySet<number>([1, 2, 3])
  )
  expectTypeCheckFail(
    type,
    arraySet<string | number>([1, 2, "3"]),
    ["items", 2],
    "number"
  )

  const typeInfo = expectValidTypeInfo(type, ArraySetTypeInfo)
  expect(typeInfo.valueType).toBe(types.number)
  expect(typeInfo.valueTypeInfo).toBe(getTypeInfo(types.number))
})

test("typing of optional values", () => {
  const t1 = types.object(() => ({
    n: types.number,
    ns: types.or(types.number, types.string),
    nsu1: types.or(types.number, types.string, types.undefined),
    nsu2: types.or(types.or(types.number, types.string), types.undefined),
    nsu3: types.or(types.number, types.or(types.string, types.undefined)),
  }))

  type T1 = TypeToData<typeof t1>

  assert(
    _ as T1,
    _ as {
      n: number
      ns: string | number
      nsu1?: string | number | undefined
      nsu2?: string | number | undefined
      nsu3?: string | number | undefined
    }
  )

  const a = types.array(types.number)
  const t2 = types.object(() => ({
    n: a,
    ns: types.or(a, types.string),
    nsu1: types.or(a, types.string, types.undefined),
    nsu2: types.or(types.or(a, types.string), types.undefined),
    nsu3: types.or(a, types.or(types.string, types.undefined)),
  }))

  type T2 = TypeToData<typeof t2>

  assert(
    _ as T2,
    _ as {
      n: number[]
      ns: string | number[]
      nsu1?: string | number[] | undefined
      nsu2?: string | number[] | undefined
      nsu3?: string | number[] | undefined
    }
  )
})

test("syntax sugar for primitives in tProp", () => {
  @model("syntaxSugar")
  class SS extends Model({
    n: tProp(42),
    s: tProp("foo"),
    b: tProp(true),
    n2: tProp(Number, 42),
    s2: tProp(String, "foo"),
    b2: tProp(Boolean, true),
    nul: tProp(null),
    undef: tProp(undefined),
    or: tProp(types.or(String, Number, Boolean)),
    arr: tProp(types.array(types.or(String, Number))),
  }) {
    @modelAction
    setN(n: number) {
      this.n = n
    }

    @modelAction
    setS(s: string) {
      this.s = s
    }

    @modelAction
    setB(b: boolean) {
      this.b = b
    }

    @modelAction
    setN2(n: number) {
      this.n2 = n
    }

    @modelAction
    setS2(s: string) {
      this.s2 = s
    }

    @modelAction
    setB2(b: boolean) {
      this.b2 = b
    }

    @modelAction
    setNul(n: null) {
      this.nul = n
    }

    @modelAction
    setUndef(u: undefined) {
      this.undef = u
    }

    @modelAction
    setOr(o: string | number | boolean) {
      this.or = o
    }
  }

  const ss = new SS({ nul: null, undef: undefined, or: 5, arr: [1, "2", 3] })
  const type = types.model<SS>(SS)
  assert(_ as TypeToData<typeof type>, _ as SS)

  assert(ss.n, _ as number)
  assert(ss.s, _ as string)
  assert(ss.b, _ as boolean)
  assert(ss.n2, _ as number)
  assert(ss.s2, _ as string)
  assert(ss.b2, _ as boolean)
  assert(ss.nul, _ as null)
  assert(ss.undef, _ as undefined)
  assert(ss.or, _ as string | number | boolean)
  assert(ss.arr, _ as (string | number)[])

  expect(ss.n).toBe(42)
  expect(ss.s).toBe("foo")
  expect(ss.b).toBe(true)
  expect(ss.n2).toBe(42)
  expect(ss.s2).toBe("foo")
  expect(ss.b2).toBe(true)
  expect(ss.nul).toBe(null)
  expect(ss.undef).toBe(undefined)
  expect(ss.or).toBe(5)
  expect(ss.arr).toEqual([1, "2", 3])

  expectTypeCheckOk(type, ss)

  ss.setN("10" as any)
  expectTypeCheckFail(type, ss, ["$", "n"], "number")
  ss.setN(42)

  ss.setS(10 as any)
  expectTypeCheckFail(type, ss, ["$", "s"], "string")
  ss.setS("foo")

  ss.setB("10" as any)
  expectTypeCheckFail(type, ss, ["$", "b"], "boolean")
  ss.setB(true)

  ss.setN2("10" as any)
  expectTypeCheckFail(type, ss, ["$", "n2"], "number")
  ss.setN2(42)

  ss.setS2(10 as any)
  expectTypeCheckFail(type, ss, ["$", "s2"], "string")
  ss.setS2("foo")

  ss.setB2("10" as any)
  expectTypeCheckFail(type, ss, ["$", "b2"], "boolean")
  ss.setB2(true)

  ss.setNul(10 as any)
  expectTypeCheckFail(type, ss, ["$", "nul"], "null")
  ss.setNul(null)

  ss.setUndef("10" as any)
  expectTypeCheckFail(type, ss, ["$", "undef"], "undefined")
  ss.setUndef(undefined)

  ss.setOr({} as any)
  expectTypeCheckFail(
    type,
    ss,
    mergeTypeCheckErrors("or", [
      createTypeCheckError(["$", "or"], "string", {}),
      createTypeCheckError(["$", "or"], "number", {}),
      createTypeCheckError(["$", "or"], "boolean", {}),
    ])
  )
  ss.setOr(5)
})

describe("model type validation", () => {
  beforeAll(() => {
    setGlobalConfig({ modelAutoTypeValidation: true })
  })

  afterAll(() => {
    setGlobalConfig({ modelAutoTypeValidation: false })
  })

  test("simple", () => {
    @model("ValidatedModel/simple", types.object(() => ({ value: types.integer })))
    class M extends Model({
      value: prop<number>(),
    }) {}

    expect(new M({ value: 10 }).typeCheck()).toBeNull()
    expect(new M({ value: 10.5 }).typeCheck()).toEqual(
      createTypeCheckError(["value"], "integer<number>", 10.5)
    )
  })

  test("complex - union", () => {
    @model(
      "ValidatedModel/complex-union",
      types.or(
        types.object(() => ({
          kind: types.literal("float"),
          value: types.number,
        })),
        types.object(() => ({
          kind: types.literal("int"),
          value: types.integer,
        }))
      )
    )
    class M extends Model({
      kind: prop<"float" | "int">(),
      value: prop<number>(),
    }) {}

    expect(new M({ kind: "float", value: 10.5 }).typeCheck()).toBeNull()
    expect(new M({ kind: "int", value: 10 }).typeCheck()).toBeNull()
    const m = new M({ kind: "int", value: 10.5 })
    expect(m.typeCheck()).toEqual(
      mergeTypeCheckErrors("or", [
        createTypeCheckError(["kind"], `"float"`, "int"),
        createTypeCheckError(["value"], `integer<number>`, 10.5),
      ])
    )
  })

  test("class property", () => {
    @model("ValidatedModel/class-property", types.object(() => ({ value: types.number })))
    class M extends Model({}) {
      value: number = 10
    }

    expect(new M({}).typeCheck()).toBeNull()
  })

  test("computed property", () => {
    @model(
      "ValidatedModel/computed-property",
      types.object(() => ({ computedValue: types.integer }))
    )
    class M extends Model({
      value: prop<number>(),
    }) {
      @computed
      get computedValue(): number {
        return this.value
      }
    }

    expect(new M({ value: 10 }).typeCheck()).toBeNull()
    expect(new M({ value: 10.5 }).typeCheck()).toEqual(
      createTypeCheckError(["computedValue"], "integer<number>", 10.5)
    )
  })

  test("child model", () => {
    @model("ValidatedModel/child-model/Child", types.object(() => ({ value: types.integer })))
    class Child extends Model({
      value: prop<number>(),
    }) {}

    @model(
      "ValidatedModel/child-model/Parent",
      types.object(() => ({ child: types.model<Child>(Child) }))
    )
    class Parent extends Model({
      child: prop<Child>(),
    }) {}

    expect(new Parent({ child: new Child({ value: 10 }) }).typeCheck()).toBeNull()

    const parent = new Parent({ child: new Child({ value: 10.5 }) })
    expect(parent.typeCheck()).toEqual(
      createTypeCheckError(["child", "value"], "integer<number>", 10.5)
    )
  })

  test("reactive context", () => {
    @model("ValidatedModel/reactive-context", types.object(() => ({ value: types.integer })))
    class M extends Model({
      value: prop<number>(),
    }) {
      @modelAction
      setValue(value: number): void {
        this.value = value
      }
    }

    const m = new M({ value: 10 })

    const errors: Array<TypeCheckErrors | null | undefined> = []
    autoDispose(
      reaction(
        () => getValidationResult(m),
        (error) => {
          errors.push(error)
        },
        { fireImmediately: true }
      )
    )

    m.setValue(10.5)
    m.setValue(11.5)
    m.setValue(11)

    expect(errors).toEqual([
      null,
      createTypeCheckError(["value"], "integer<number>", 10.5),
      createTypeCheckError(["value"], "integer<number>", 11.5),
      null,
    ])
  })

  test("reactive context with child models", () => {
    @model(
      "ValidatedModel/reactive-context-with-child-models/Child",
      types.object(() => ({ value: types.integer }))
    )
    class Child extends Model({
      value: prop<number>(),
    }) {
      @modelAction
      setValue(value: number): void {
        this.value = value
      }
    }

    @model(
      "ValidatedModel/reactive-context-with-child-models/Parent",
      types.object(() => ({ child1: types.model<Child>(Child), child2: types.model<Child>(Child) }))
    )
    class Parent extends Model({
      child1: prop<Child>(),
      child2: prop<Child>(),
    }) {}

    const child1 = new Child({ value: 10 })
    const child2 = new Child({ value: 20 })
    const parent = new Parent({ child1, child2 })

    const errors: Record<
      "parent" | "child1" | "child2",
      Array<TypeCheckErrors | null | undefined>
    > = {
      parent: [],
      child1: [],
      child2: [],
    }
    autoDispose(
      reaction(
        () => getValidationResult(parent),
        (error) => {
          errors.parent.push(error)
        },
        { fireImmediately: true }
      )
    )
    autoDispose(
      reaction(
        () => getValidationResult(child1),
        (error) => {
          errors.child1.push(error)
        },
        { fireImmediately: true }
      )
    )
    autoDispose(
      reaction(
        () => getValidationResult(child2),
        (error) => {
          errors.child2.push(error)
        },
        { fireImmediately: true }
      )
    )

    child1.setValue(10.5)
    child1.setValue(11.5)
    child1.setValue(11)

    expect(errors).toEqual({
      parent: [
        null,
        createTypeCheckError(["child1", "value"], "integer<number>", 10.5),
        createTypeCheckError(["child1", "value"], "integer<number>", 11.5),
        null,
      ],
      child1: [
        null,
        createTypeCheckError(["value"], "integer<number>", 10.5),
        createTypeCheckError(["value"], "integer<number>", 11.5),
        null,
      ],
      child2: [null],
    })
  })
})
