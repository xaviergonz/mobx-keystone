import { reaction, toJS } from "mobx"
import { _, assert } from "spec.ts"
import {
  AnyModel,
  AnyType,
  ArraySet,
  ArraySetTypeInfo,
  ArrayTypeInfo,
  actionTrackingMiddleware,
  applySnapshot,
  arraySet,
  BooleanTypeInfo,
  customRef,
  DataModel,
  Frozen,
  FrozenTypeInfo,
  fromSnapshot,
  frozen,
  getSnapshot,
  getTypeInfo,
  idProp,
  LiteralTypeInfo,
  MobxKeystoneError,
  Model,
  ModelAutoTypeCheckingMode,
  ModelTypeInfo,
  ModelTypeInfoProps,
  modelAction,
  modelIdKey,
  modelTypeKey,
  NumberTypeInfo,
  ObjectMap,
  ObjectMapTypeInfo,
  ObjectTypeInfo,
  ObjectTypeInfoProps,
  OrTypeInfo,
  objectMap,
  onPatches,
  onSnapshot,
  Path,
  PathElement,
  prop,
  RecordTypeInfo,
  Ref,
  RefinementTypeInfo,
  RefTypeInfo,
  resolvePath,
  rootRef,
  SnapshotTypeMismatchError,
  StringTypeInfo,
  setGlobalConfig,
  TagTypeInfo,
  TupleTypeInfo,
  TypeCheckError,
  TypeCheckErrorFailure,
  TypeInfo,
  TypeToData,
  tProp,
  typeCheck,
  types,
  UncheckedTypeInfo,
} from "../../src"
import { enumValues } from "../../src/types/primitiveBased/typesEnum"
import { resolveStandardType, resolveTypeChecker } from "../../src/types/resolveTypeChecker"
import { typeCheckInternal } from "../../src/types/typeCheck"
import { autoDispose, testModel } from "../utils"

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

function pathsEqual(pathA: Path, pathB: Path): boolean {
  if (pathA.length !== pathB.length) {
    return false
  }
  for (let i = 0; i < pathA.length; i++) {
    if (pathA[i] !== pathB[i]) {
      return false
    }
  }
  return true
}

function typeCheckWithTouchedPaths<T extends AnyType>(
  type: T,
  value: TypeToData<T>,
  touchedPaths: ReadonlyArray<Path>
): TypeCheckError | null {
  if (touchedPaths.length <= 0) {
    return null
  }

  const firstTouchedPath = touchedPaths[0]
  if (firstTouchedPath.length <= 0) {
    throw new Error(
      "typeCheckWithTouchedPaths only supports non-empty paths; use typeCheck(...) for full checks"
    )
  }

  const changedObjPath = firstTouchedPath.slice(0, -1)
  const touchedChildren = new Set<PathElement>([firstTouchedPath[firstTouchedPath.length - 1]])
  for (let i = 1; i < touchedPaths.length; i++) {
    const touchedPath = touchedPaths[i]
    if (touchedPath.length <= 0) {
      throw new Error(
        "typeCheckWithTouchedPaths only supports non-empty paths; use typeCheck(...) for full checks"
      )
    }

    const touchedPathParent = touchedPath.slice(0, -1)
    if (!pathsEqual(touchedPathParent, changedObjPath)) {
      throw new Error(
        "typeCheckWithTouchedPaths only supports touched paths with the same parent path"
      )
    }

    touchedChildren.add(touchedPath[touchedPath.length - 1])
  }

  return typeCheckInternal<any>(type as any, value as any, changedObjPath, touchedChildren)
}

function modelTypeCheckWithTouchedPaths(model: AnyModel, touchedPaths: ReadonlyArray<Path>) {
  return typeCheckWithTouchedPaths(
    types.model<any, any>(model.constructor as any),
    model as any,
    touchedPaths
  )
}

function expectTypeCheckFail<T extends AnyType>(
  t: T,
  val: any,
  path: Path,
  expected: string,
  typeCheckedValue: any = val
) {
  const { value: actualValue } = resolvePath(val, path)

  const err = typeCheck(t, val)!
  expect(err).toBeInstanceOf(TypeCheckError)
  expect(err).toEqual(
    new TypeCheckError({
      path,
      expectedTypeName: expected,
      actualValue,
      typeCheckedValue,
    })
  )
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

test("TypeCheckError constructor supports both object and positional signatures", () => {
  const objectErr = new TypeCheckError({
    path: ["x"],
    expectedTypeName: "number",
    actualValue: "10",
  })
  const positionalErr = new TypeCheckError(["x"], "number", "10")

  expect(objectErr).toEqual(positionalErr)
  expect(objectErr.message).toBe(positionalErr.message)
})

test("TypeCheckError.throw() throws TypeCheckErrorFailure", () => {
  const err = new TypeCheckError({
    path: ["x"],
    expectedTypeName: "number",
    actualValue: "10",
  })

  expect(err).not.toBeInstanceOf(MobxKeystoneError)

  try {
    err.throw()
    throw new Error("expected throw() to throw")
  } catch (thrown) {
    expect(thrown).toBeInstanceOf(TypeCheckErrorFailure)
    expect(thrown).toBeInstanceOf(MobxKeystoneError)
  }
})

test("TypeCheckError full path resolution handles relative, empty and rooted paths", () => {
  @testModel("issue #570/TypeCheckPathInner")
  class TypeCheckPathInner extends Model({
    value: tProp(types.string),
  }) {}

  @testModel("issue #570/TypeCheckPathOuter")
  class TypeCheckPathOuter extends Model({
    child: tProp(TypeCheckPathInner),
  }) {}

  const outer = new TypeCheckPathOuter({
    child: new TypeCheckPathInner({
      value: "ok",
    }),
  })

  const check = (path: Path, expectedPath: Path) => {
    const err = new TypeCheckError({
      path,
      expectedTypeName: "string",
      actualValue: 123,
      typeCheckedValue: outer.child,
    })

    try {
      err.throw()
      throw new Error("expected throw() to throw")
    } catch (thrown) {
      const e = thrown as TypeCheckErrorFailure
      expect(e.path).toEqual(expectedPath)
    }
  }

  check([], ["child"])
  check(["value"], ["child", "value"])
  check(["child", "value"], ["child", "value"])
})

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
  expectTypeCheckFail(type, "ho", [], "number | boolean")

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([types.number, types.boolean])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.boolean)])
})

test("or - simple simple types", () => {
  const type = types.or(Number, Boolean)
  assert(_ as TypeToData<typeof type>, _ as number | boolean)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, false)
  expectTypeCheckFail(type, "ho", [], "number | boolean")

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([types.number, types.boolean])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.boolean)])
})

test("maybe", () => {
  const type = types.maybe(types.number)
  assert(_ as TypeToData<typeof type>, _ as number | undefined)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, undefined)
  expectTypeCheckFail(type, "ho", [], "number | undefined")

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypes).toEqual([types.number, types.undefined])
  expect(typeInfo.orTypeInfos).toEqual([getTypeInfo(types.number), getTypeInfo(types.undefined)])
})

test("maybeNull", () => {
  const type = types.maybeNull(types.number)
  assert(_ as TypeToData<typeof type>, _ as number | null)

  expectTypeCheckOk(type, 6)
  expectTypeCheckOk(type, null)
  expectTypeCheckFail(type, "ho", [], "number | null")

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
  type T = TypeToData<typeof type>
  assert(_ as T, _ as Record<string, number>)

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
  expectTypeCheckFail(type, { x: 5, y: 6 }, ["y"], "string | undefined")
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

test("typeCheck with touched paths", () => {
  const type = types.object(() => ({
    x: types.number,
    y: types.string,
  }))

  const wrongValue = { x: "bad" as any, y: "ok" }

  expect(typeCheckWithTouchedPaths(type, wrongValue, [["y"]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [["x"]])).toEqual(
    new TypeCheckError({
      path: ["x"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )
  expectTypeCheckFail(type, wrongValue, ["x"], "number")
})

test("typeCheckInternal with empty touched children skips checks", () => {
  const type = types.object(() => ({
    x: types.number,
  }))
  const wrongValue = { x: "bad" as any }

  expect(
    typeCheckInternal<any>(type as any, wrongValue as any, [], new Set<PathElement>())
  ).toBeNull()
  expectTypeCheckFail(type, wrongValue, ["x"], "number")
})

test("typeCheckInternal full checks require touchedChildren='all'", () => {
  const type = types.number

  expect(() =>
    typeCheckInternal<any>(type as any, 1 as any, undefined, new Set<PathElement>())
  ).toThrow("assertion failed: full internal type-check must use touchedChildren='all'")
})

test("typeCheck with touched paths forwards through types.or", () => {
  let counters = { a: 0, b: 0 }
  const objectType = types.object(() => ({
    a: types.refinement(types.number, () => {
      counters.a++
      return true
    }),
    b: types.refinement(types.number, () => {
      counters.b++
      return true
    }),
  }))

  const type = types.or(objectType, types.string)
  const value = { a: 1, b: 2 }

  // types.or always does a full check to avoid false positives with overlapping unions
  counters = { a: 0, b: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["a"]])).toBeNull()
  expect(counters).toEqual({ a: 1, b: 1 })

  counters = { a: 0, b: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["b"]])).toBeNull()
  expect(counters).toEqual({ a: 1, b: 1 })

  counters = { a: 0, b: 0 }
  expect(typeCheck(type, value)).toBeNull()
  expect(counters).toEqual({ a: 1, b: 1 })
})

test("typeCheck with touched paths for types.or with overlapping object unions detects errors", () => {
  // types.or with overlapping object types must full-check to avoid false positives.
  // If partially checked, a value could pass by matching different alternatives for different properties.
  const type = types.or(
    types.object(() => ({ a: types.number, b: types.number })),
    types.object(() => ({ a: types.string, b: types.string }))
  )

  // Start with a valid value for the first alternative
  const value: { a: number; b: number } | { a: string; b: string } = { a: 1, b: 2 }
  expect(typeCheck(type, value)).toBeNull()

  // Mutate `a` to a string — now value is { a: "hello", b: 2 } which doesn't fully match either alternative
  ;(value as { a: string | number; b: number }).a = "hello"

  // Full check correctly detects the error
  expect(typeCheck(type, value)).not.toBeNull()

  // Partial check touching only "a" must also detect the error (not produce a false positive pass)
  expect(typeCheckWithTouchedPaths(type, value, [["a"]])).not.toBeNull()
})

test("typeCheck with touched paths forwards through types.refinement", () => {
  let counters = { a: 0, b: 0, refinement: 0 }
  const baseType = types.object(() => ({
    a: types.refinement(types.number, () => {
      counters.a++
      return true
    }),
    b: types.refinement(types.number, () => {
      counters.b++
      return true
    }),
  }))

  const type = types.refinement(baseType, () => {
    counters.refinement++
    return null
  })
  const value = { a: 1, b: 2 }

  counters = { a: 0, b: 0, refinement: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["a"]])).toBeNull()
  expect(counters).toEqual({ a: 1, b: 0, refinement: 1 })

  counters = { a: 0, b: 0, refinement: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["b"]])).toBeNull()
  expect(counters).toEqual({ a: 0, b: 1, refinement: 1 })

  counters = { a: 0, b: 0, refinement: 0 }
  expect(typeCheck(type, value)).toBeNull()
  expect(counters).toEqual({ a: 1, b: 1, refinement: 1 })
})

test("typeCheck with touched paths forwards through types.tag", () => {
  let counters = { a: 0, b: 0 }
  const baseType = types.object(() => ({
    a: types.refinement(types.number, () => {
      counters.a++
      return true
    }),
    b: types.refinement(types.number, () => {
      counters.b++
      return true
    }),
  }))

  const type = types.tag(baseType, { purpose: "touched-path-test" }, "taggedTestType")
  const value = { a: 1, b: 2 }

  counters = { a: 0, b: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["a"]])).toBeNull()
  expect(counters).toEqual({ a: 1, b: 0 })

  counters = { a: 0, b: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["b"]])).toBeNull()
  expect(counters).toEqual({ a: 0, b: 1 })

  counters = { a: 0, b: 0 }
  expect(typeCheck(type, value)).toBeNull()
  expect(counters).toEqual({ a: 1, b: 1 })
})

test("typeCheck with touched paths forwards through types.dataModelData", () => {
  let counters = { a: 0, b: 0 }

  @testModel("TouchedPathDataModel")
  class TouchedPathDataModel extends DataModel({
    a: tProp(
      types.refinement(types.number, () => {
        counters.a++
        return true
      })
    ),
    b: tProp(
      types.refinement(types.number, () => {
        counters.b++
        return true
      })
    ),
  }) {}

  const type = types.dataModelData(TouchedPathDataModel)
  const value = { a: 1, b: 2 }

  counters = { a: 0, b: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["a"]])).toBeNull()
  expect(counters).toEqual({ a: 1, b: 0 })

  counters = { a: 0, b: 0 }
  expect(typeCheckWithTouchedPaths(type, value, [["b"]])).toBeNull()
  expect(counters).toEqual({ a: 0, b: 1 })

  counters = { a: 0, b: 0 }
  expect(typeCheck(type, value)).toBeNull()
  expect(counters).toEqual({ a: 1, b: 1 })
})

test("array typeCheck with touched paths", () => {
  const type = types.array(types.number)

  const wrongValue = [1, "bad" as any, 3]

  expect(typeCheckWithTouchedPaths(type, wrongValue, [[0]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [[1]])).toEqual(
    new TypeCheckError({
      path: [1],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )

  // out-of-bounds touched indexes can happen on remove operations; they should be ignored
  expect(typeCheckWithTouchedPaths(type, wrongValue, [[10]])).toBeNull()
})

test("array typeCheck with nested touched paths", () => {
  const type = types.array(
    types.object(() => ({
      x: types.number,
      y: types.number,
    }))
  )

  const wrongValue = [{ x: 1, y: "bad" as any }]

  expect(typeCheckWithTouchedPaths(type, wrongValue, [[0, "x"]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [[0, "y"]])).toEqual(
    new TypeCheckError({
      path: [0, "y"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )
})

test("record typeCheck with touched paths", () => {
  const type = types.record(types.number)

  const wrongValue = { x: "bad" as any, y: 1 }

  expect(typeCheckWithTouchedPaths(type, wrongValue, [["y"]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [["x"]])).toEqual(
    new TypeCheckError({
      path: ["x"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )
})

test("record typeCheck with nested touched paths", () => {
  const type = types.record(
    types.object(() => ({
      x: types.number,
      y: types.number,
    }))
  )

  const wrongValue = { a: { x: 1, y: "bad" as any } }

  expect(typeCheckWithTouchedPaths(type, wrongValue, [["a", "x"]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [["a", "y"]])).toEqual(
    new TypeCheckError({
      path: ["a", "y"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )
})

test("tuple typeCheck with touched paths", () => {
  const type = types.tuple(types.number, types.string)

  const wrongValue = [1, 2 as any] as [number, any]

  expect(typeCheckWithTouchedPaths(type, wrongValue, [[0]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [[1]])).toEqual(
    new TypeCheckError({
      path: [1],
      expectedTypeName: "string",
      actualValue: 2,
      typeCheckedValue: wrongValue,
    })
  )
})

test("tuple typeCheck with nested touched paths", () => {
  const type = types.tuple(
    types.object(() => ({
      x: types.number,
      y: types.number,
    })),
    types.string
  )

  const wrongValue = [{ x: 1, y: "bad" as any }, "ok"] as [any, string]

  expect(typeCheckWithTouchedPaths(type, wrongValue, [[0, "x"]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [[0, "y"]])).toEqual(
    new TypeCheckError({
      path: [0, "y"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )

  // out-of-bounds touched indexes can happen on remove operations; they should be ignored
  expect(typeCheckWithTouchedPaths(type, wrongValue, [[10]])).toBeNull()
})

test("objectMap typeCheck with touched paths", () => {
  const type = types.objectMap(types.number)

  const wrongValue = objectMap<number | any>([
    ["a", 1],
    ["b", "bad"],
  ])

  expect(typeCheckWithTouchedPaths(type, wrongValue as any, [["items", "a"]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue as any, [["items", "b"]])).toEqual(
    new TypeCheckError({
      path: ["items", "b"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )
})

test("arraySet typeCheck with touched paths", () => {
  const type = types.arraySet(types.number)

  const wrongValue = arraySet<number | any>([1, "bad"])

  expect(typeCheckWithTouchedPaths(type, wrongValue as any, [["items", 0]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue as any, [["items", 1]])).toEqual(
    new TypeCheckError({
      path: ["items", 1],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: wrongValue,
    })
  )
})

test("ref typeCheck with touched paths", () => {
  const m = new M({ y: "6" })
  const customR = customRef<M>("customRefM_touched", {
    resolve() {
      return m
    },
    getId(target) {
      return "" + (target as M).y
    },
  })
  const type = types.ref(customR)

  const wrongValue = new customR.refClass({ id: 10 as any }) as Ref<M>

  expect(typeCheckWithTouchedPaths(type, wrongValue, [["otherProp"]])).toBeNull()
  expect(typeCheckWithTouchedPaths(type, wrongValue, [["id"]])).toEqual(
    new TypeCheckError({
      path: ["id"],
      expectedTypeName: "string",
      actualValue: 10,
      typeCheckedValue: wrongValue,
    })
  )
})

@testModel("TouchedPathNestedStaleCacheModel")
class TouchedPathNestedStaleCacheModel extends Model({
  nested: tProp(
    types.object(() => ({
      x: types.number,
      y: types.number,
    }))
  ),
}) {
  @modelAction
  setNestedX(v: number) {
    this.nested.x = v
  }

  @modelAction
  setNestedY(v: number) {
    this.nested.y = v
  }
}

test("typeCheck with touched paths does not reuse stale cache for different nested paths", () => {
  const m = new TouchedPathNestedStaleCacheModel({ nested: { x: 1, y: 2 } })

  m.setNestedY("bad" as any)
  expect(modelTypeCheckWithTouchedPaths(m, [["nested", "x"]])).toBeNull()
  expect(modelTypeCheckWithTouchedPaths(m, [["nested", "y"]])).toEqual(
    new TypeCheckError({
      path: ["nested", "y"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: m,
    })
  )

  m.setNestedY(2)
  m.setNestedX("bad" as any)
  expect(modelTypeCheckWithTouchedPaths(m, [["nested", "y"]])).toBeNull()
  expect(modelTypeCheckWithTouchedPaths(m, [["nested", "x"]])).toEqual(
    new TypeCheckError({
      path: ["nested", "x"],
      expectedTypeName: "number",
      actualValue: "bad",
      typeCheckedValue: m,
    })
  )
})

let touchedPathCacheValidationCounters = { a: 0, b: 0 }
const touchedPathCacheValidationNestedType = types.object(() => ({
  a: types.refinement(types.number, () => {
    touchedPathCacheValidationCounters.a++
    return true
  }),
  b: types.refinement(types.number, () => {
    touchedPathCacheValidationCounters.b++
    return true
  }),
}))

@testModel("TouchedPathCacheValidationModel")
class TouchedPathCacheValidationModel extends Model({
  nested: tProp(touchedPathCacheValidationNestedType),
}) {
  @modelAction
  setA(v: number) {
    this.nested.a = v
  }

  @modelAction
  setB(v: number) {
    this.nested.b = v
  }
}

test("touched paths invalidate only touched key typecheck caches", () => {
  touchedPathCacheValidationCounters = { a: 0, b: 0 }
  const m = new TouchedPathCacheValidationModel({ nested: { a: 1, b: 2 } })

  expect(m.typeCheck()).toBeNull()
  expect(touchedPathCacheValidationCounters).toEqual({ a: 1, b: 1 })

  m.setA(3)
  expect(modelTypeCheckWithTouchedPaths(m, [["nested", "a"]])).toBeNull()
  expect(touchedPathCacheValidationCounters).toEqual({ a: 2, b: 1 })

  m.setB(4)
  expect(modelTypeCheckWithTouchedPaths(m, [["nested", "b"]])).toBeNull()
  expect(touchedPathCacheValidationCounters).toEqual({ a: 2, b: 2 })

  expect(m.typeCheck()).toBeNull()
  expect(touchedPathCacheValidationCounters).toEqual({ a: 2, b: 2 })
})

const mArrType = types.array(types.number)
const mArrDefault = () => []

@testModel("M")
class M extends Model({
  [modelIdKey]: idProp,
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
  const type = types.model(M)
  assert(_ as TypeToData<typeof type>, _ as M)

  expectTypeCheckOk(type, m)
  expect(m.typeCheck()).toBeNull()

  expectTypeCheckFail(type, "ho", [], `Model(${m.$modelType})`)
  expectTypeCheckFail(type, new MR({}), [], `Model(${m.$modelType})`)
  m.setX("10" as any)
  expectTypeCheckFail(type, m, ["x"], "number")
  expect(m.typeCheck()).toEqual(
    new TypeCheckError({
      path: ["x"],
      expectedTypeName: "number",
      actualValue: "10",
      typeCheckedValue: m,
    })
  )

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
  const type = types.model(M)
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
  expect(toJS(m.arr)).toEqual([])

  m.setArr([1, 2])
  expect(toJS(m.arr)).toEqual([1, 2])

  expectTypeCheckError(m, () => {
    m.addArr("3" as any)
  })
  expect(toJS(m.arr)).toEqual([1, 2])
})

test("model typechecking with touched paths", () => {
  const m = new M({ y: "6" })

  m.setX("10" as any)
  expect(modelTypeCheckWithTouchedPaths(m, [["y"]])).toBeNull()
  expect(modelTypeCheckWithTouchedPaths(m, [["x"]])).toEqual(
    new TypeCheckError({
      path: ["x"],
      expectedTypeName: "number",
      actualValue: "10",
      typeCheckedValue: m,
    })
  )

  m.setX(10)
  m.setArr([1, "2" as any])
  expect(modelTypeCheckWithTouchedPaths(m, [["arr", 1]])).toEqual(
    new TypeCheckError({
      path: ["arr", 1],
      expectedTypeName: "number",
      actualValue: "2",
      typeCheckedValue: m,
    })
  )
})

@testModel("TouchedPathMultiPatchModel")
class TouchedPathMultiPatchModel extends Model({
  a: tProp(types.number),
  b: tProp(types.number),
}) {
  @modelAction
  setBoth(a: number, b: number) {
    this.a = a
    this.b = b
  }
}

test("auto typechecking handles actions that touch multiple children", () => {
  const m = new TouchedPathMultiPatchModel({ a: 1, b: 2 })

  expectTypeCheckError(m, () => {
    m.setBoth("bad" as any, 3)
  })

  expect(m.a).toBe(1)
  expect(m.b).toBe(2)
})

test("single action can touch multiple children", () => {
  const m = new TouchedPathMultiPatchModel({ a: 1, b: 2 })
  const touchedChildren = new Set<PathElement>()
  const disposer = onPatches(m, (patches: any[]) => {
    for (const p of patches) {
      touchedChildren.add(p.path[0])
    }
  })

  m.setBoth(3, 4)
  disposer()

  expect(touchedChildren).toEqual(new Set<PathElement>(["a", "b"]))
})

@testModel("TouchedPathArraySpliceMultiPatchModel")
class TouchedPathArraySpliceMultiPatchModel extends Model({
  arr: tProp(types.array(types.number)),
}) {
  @modelAction
  spliceReplaceOneWithTwo() {
    this.arr.splice(0, 1, 9, 8)
  }
}

test("array splice can emit multiple patches in one batch", () => {
  const m = new TouchedPathArraySpliceMultiPatchModel({ arr: [1, 2, 3] })
  let sawMultiPatchBatch = false
  const disposer = onPatches(m, (patches) => {
    if (patches.length > 1) {
      sawMultiPatchBatch = true
    }
  })

  m.spliceReplaceOneWithTwo()
  disposer()

  expect(sawMultiPatchBatch).toBe(true)
})

@testModel("AutoTypecheckApplySnapshotRollbackModel")
class AutoTypecheckApplySnapshotRollbackModel extends Model({
  nested: tProp(
    types.object(() => ({
      x: types.number,
    }))
  ),
}) {
  @modelAction
  setNestedX(v: number) {
    this.nested.x = v
  }
}

test("applySnapshot rolls back on auto typecheck errors", () => {
  const m = new AutoTypecheckApplySnapshotRollbackModel({ nested: { x: 1 } })
  const beforeSnapshot = getSnapshot(m.nested)

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
  try {
    expect(() =>
      applySnapshot(m.nested, {
        ...beforeSnapshot,
        x: "bad" as any,
      })
    ).toThrow(TypeCheckErrorFailure)
  } finally {
    setGlobalConfig({
      modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
    })
  }

  expect(m.nested.x).toBe(1)
})

@testModel("AutoTypecheckUntypedOnlyModel")
class AutoTypecheckUntypedOnlyModel extends Model({
  value: prop(1),
}) {
  @modelAction
  setValue(v: number) {
    this.value = v
  }
}

test("auto typechecking skips models without a runtime type checker", () => {
  const m = new AutoTypecheckUntypedOnlyModel({ value: 1 })

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
  try {
    m.setValue("bad" as any)
  } finally {
    setGlobalConfig({
      modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
    })
  }

  expect(m.value).toBe("bad")
})

test("auto typechecking on nested model changes enforces parent property refinement", () => {
  @testModel("AutoTypecheckParentRefinementChildModel")
  class AutoTypecheckParentRefinementChildModel extends Model({
    x: tProp(types.number),
  }) {
    @modelAction
    setX(v: number) {
      this.x = v
    }
  }

  const positiveXChildType = types.refinement(
    types.model(AutoTypecheckParentRefinementChildModel),
    (child) => child.x > 0,
    "positiveXChild"
  )

  @testModel("AutoTypecheckParentRefinementParentModel")
  class AutoTypecheckParentRefinementParentModel extends Model({
    child: tProp(positiveXChildType),
  }) {}

  const parent = new AutoTypecheckParentRefinementParentModel({
    child: new AutoTypecheckParentRefinementChildModel({ x: 1 }),
  })

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
  try {
    expect(() => parent.child.setX(-1)).toThrow(TypeCheckErrorFailure)
  } finally {
    setGlobalConfig({
      modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
    })
  }

  expect(parent.child.x).toBe(1)
  expect(parent.typeCheck()).toBeNull()
})

test("auto typechecking does NOT promote when child model has own refinement but parent has none", () => {
  // Child model uses types.integer (a refinement) on its own prop.
  // Parent model wraps child WITHOUT any parent-level refinement.
  // Mutating the child should be caught by the child model's own type-checking,
  // not by promoting to the parent.
  @testModel("NoPromoteChildWithOwnRefinement")
  class NoPromoteChild extends Model({
    x: tProp(types.integer),
  }) {
    @modelAction
    setX(v: number) {
      this.x = v
    }
  }

  @testModel("NoPromoteParentNoRefinement")
  class NoPromoteParent extends Model({
    child: tProp(types.model(NoPromoteChild)),
  }) {}

  const parent = new NoPromoteParent({
    child: new NoPromoteChild({ x: 1 }),
  })

  // Setting a non-integer should be caught by the child's own type-checking
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
  try {
    expect(() => parent.child.setX(1.5)).toThrow(TypeCheckErrorFailure)
  } finally {
    setGlobalConfig({
      modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
    })
  }

  expect(parent.child.x).toBe(1)
  expect(parent.typeCheck()).toBeNull()
})

test("auto typechecking promotes through deeply nested grandparent refinement", () => {
  @testModel("DeepRefinementGrandchild")
  class DeepGrandchild extends Model({
    value: tProp(types.number),
  }) {
    @modelAction
    setValue(v: number) {
      this.value = v
    }
  }

  @testModel("DeepRefinementChild")
  class DeepChild extends Model({
    grandchild: tProp(types.model(DeepGrandchild)),
  }) {}

  const positiveGrandchildValueType = types.refinement(
    types.model(DeepChild),
    (child) => child.grandchild.value > 0,
    "positiveGrandchildValue"
  )

  @testModel("DeepRefinementGrandparent")
  class DeepGrandparent extends Model({
    child: tProp(positiveGrandchildValueType),
  }) {}

  const gp = new DeepGrandparent({
    child: new DeepChild({
      grandchild: new DeepGrandchild({ value: 5 }),
    }),
  })

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
  try {
    expect(() => gp.child.grandchild.setValue(-1)).toThrow(TypeCheckErrorFailure)
  } finally {
    setGlobalConfig({
      modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
    })
  }

  expect(gp.child.grandchild.value).toBe(5)
  expect(gp.typeCheck()).toBeNull()
})

test("refinement cache is reused across multiple mutations on same model class", () => {
  @testModel("CacheReuseChild")
  class CacheReuseChild extends Model({
    x: tProp(types.number),
  }) {
    @modelAction
    setX(v: number) {
      this.x = v
    }
  }

  const positiveChildType = types.refinement(
    types.model(CacheReuseChild),
    (child) => child.x > 0,
    "positiveChild"
  )

  @testModel("CacheReuseParent")
  class CacheReuseParent extends Model({
    child: tProp(positiveChildType),
  }) {}

  const p1 = new CacheReuseParent({
    child: new CacheReuseChild({ x: 1 }),
  })
  const p2 = new CacheReuseParent({
    child: new CacheReuseChild({ x: 2 }),
  })

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
  try {
    // First mutation triggers cache population
    expect(() => p1.child.setX(-1)).toThrow(TypeCheckErrorFailure)
    expect(p1.child.x).toBe(1)

    // Second mutation on a different instance of the same class should hit cache
    expect(() => p2.child.setX(-2)).toThrow(TypeCheckErrorFailure)
    expect(p2.child.x).toBe(2)
  } finally {
    setGlobalConfig({
      modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
    })
  }
})

@testModel("TouchedPathDollarKeyModel")
class TouchedPathDollarKeyModel extends Model({
  nested: tProp(
    types.object(() => ({
      $: types.object(() => ({
        x: types.number,
      })),
    }))
  ),
}) {
  @modelAction
  setNestedDollarX(v: number) {
    this.nested.$.x = v
  }
}

test("auto typechecking keeps real '$' object keys in changed-object path", () => {
  const m = new TouchedPathDollarKeyModel({
    nested: {
      $: { x: 1 },
    },
  })

  expectTypeCheckError(m, () => {
    m.setNestedDollarX("bad" as any)
  })

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  try {
    m.setNestedDollarX("bad" as any)
    throw new Error("expected setNestedDollarX to throw")
  } catch (thrown) {
    expect(thrown).toBeInstanceOf(TypeCheckErrorFailure)
    expect((thrown as TypeCheckErrorFailure).path).toEqual(["nested", "$", "x"])
  } finally {
    setGlobalConfig({
      modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
    })
  }

  expect(m.nested.$.x).toBe(1)
})

test("new model with typechecking enabled", () => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  expect(() => new M({ x: 10, y: 20 as any })).toThrow(
    "TypeCheckError: Expected a value of type <string> but got an incompatible value - Path: /y - Value: 20"
  )
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

test("record - complex types", () => {
  const valueType = types.object(() => ({
    y: types.string,
  }))

  const type = types.record(valueType)
  assert(_ as TypeToData<typeof type>, _ as Record<string, { y: string }>)

  expectTypeCheckOk(type, { o: { y: "6" } })

  const expected = "Record<{ y: string; }>"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { o: 6 }, ["o"], "{ y: string; }")
  expectTypeCheckFail(type, { o: { y: 6 } }, ["o", "y"], "string")

  const typeInfo = expectValidTypeInfo(type, RecordTypeInfo)
  expect(typeInfo.valueType).toEqual(valueType)
  expect(typeInfo.valueTypeInfo).toEqual(getTypeInfo(valueType))
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

  const expected = "{ y: string; } | number"
  expectTypeCheckFail(type, "ho", [], expected)
  expectTypeCheckFail(type, { y: 6 }, [], expected)

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
    { x: 5, rec: { x: "6" } },
    ["rec"],
    // won't say anything of the wrong x because of the or (maybe) type
    "{ x: number; rec: ...; } | undefined"
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
    { x: 5, b: { y: "6", a: undefined } },
    ["b"],
    // won't say anything of the wrong y because of the or (maybe) type
    "{ y: number; a: { x: number; b: ...; } | undefined; } | undefined"
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

@testModel("MR")
class MR extends Model({
  x: tProp(types.number, 10),
  rec: tProp(types.maybe(types.model<MR>(() => _MR))),
}) {
  @modelAction
  setRec(r: MR | undefined) {
    this.rec = r
  }
}
// workaround over a babel bug: https://github.com/babel/babel/issues/11131
const _MR = MR

test("recursive model", () => {
  const type = types.model(MR)

  const mr = new MR({ rec: new MR({}) })
  assert(_ as TypeToData<typeof type>, _ as MR)

  expectTypeCheckOk(type, mr)

  mr.setRec("5" as any)
  expectTypeCheckFail(type, mr, ["rec"], "Model(MR) | undefined")

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

@testModel("MA")
class MA extends Model({
  x: tProp(types.number, 10),
  b: tProp(types.maybe(types.model<MB>(() => MB))),
}) {
  @modelAction
  setB(r: MB | undefined) {
    this.b = r
  }
}

@testModel("MB")
class MB extends Model({
  y: tProp(types.number, 20),
  a: tProp(types.maybe(MA)),
}) {
  @modelAction
  setA(r: MA | undefined) {
    this.a = r
  }
}

test("cross referenced model", () => {
  const type = types.model(MA)

  const ma = new MA({ b: new MB({ a: new MA({}) }) })
  assert(_ as TypeToData<typeof type>, _ as MA)

  expectTypeCheckOk(type, ma)

  ma.b!.setA("5" as any)
  expectTypeCheckFail(type, ma, ["b"], "Model(MB) | undefined")

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
  const m = new M({ y: "6" })
  const customR = customRef<M>("customRefM", {
    resolve() {
      return m
    },
    getId(target) {
      return "" + (target as M).y
    },
  })
  const r = customR(m)
  const type = types.ref(customR)
  assert(_ as TypeToData<typeof type>, _ as Ref<M>)

  expectTypeCheckOk(type, r)
  expectTypeCheckFail(type, m, [], "Ref")

  expectValidTypeInfo(type, RefTypeInfo)
})

test("frozen - simple type", () => {
  const type = types.frozen(types.number)
  type T = TypeToData<typeof type>
  assert(_ as T, _ as Frozen<number>)

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
  type T = TypeToData<typeof type>
  assert(_ as T, _ as Frozen<{ x: number }>)

  const fr = frozen<{ x: number }>({ x: 5 })

  expectTypeCheckOk(type, fr)
  expectTypeCheckFail(type, 5, [], "{ data: { x: number; }; }")

  const typeInfo = expectValidTypeInfo(type, FrozenTypeInfo)
  expect(typeInfo.dataType).toBe(dataType)
  expect(typeInfo.dataTypeInfo).toBe(getTypeInfo(dataType))
})

test("enumValues (string)", () => {
  enum A {
    X1 = "x1",
    X2 = "x2",
  }

  expect(enumValues(A)).toEqual(["x1", "x2"])
})

test("enum (string)", () => {
  enum A {
    X1 = "x1",
    X2 = "x2",
  }

  const type = types.enum(A)

  assert(_ as TypeToData<typeof type>, _ as A)

  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(type, "X1", [], `"x1" | "x2"`)

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypeInfos).toHaveLength(2)
  const orA = typeInfo.orTypeInfos[0] as LiteralTypeInfo
  expect(orA).toBeInstanceOf(LiteralTypeInfo)
  expect(orA.literal).toBe(A.X1)
  const orB = typeInfo.orTypeInfos[1] as LiteralTypeInfo
  expect(orB).toBeInstanceOf(LiteralTypeInfo)
  expect(orB.literal).toBe(A.X2)
})

test("enumValues (number)", () => {
  enum A {
    X1 = 0,
    X2 = 1,
  }

  expect(enumValues(A)).toEqual([0, 1])
})

test("enum (number)", () => {
  enum A {
    X1 = 0,
    X2 = 1,
  }

  const type = types.enum(A)

  assert(_ as TypeToData<typeof type>, _ as A)

  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(type, "X1", [], `0 | 1`)

  const typeInfo = expectValidTypeInfo(type, OrTypeInfo)
  expect(typeInfo.orTypeInfos).toHaveLength(2)
  const orA = typeInfo.orTypeInfos[0] as LiteralTypeInfo
  expect(orA).toBeInstanceOf(LiteralTypeInfo)
  expect(orA.literal).toBe(A.X1)
  const orB = typeInfo.orTypeInfos[1] as LiteralTypeInfo
  expect(orB).toBeInstanceOf(LiteralTypeInfo)
  expect(orB.literal).toBe(A.X2)
})

test("enumValues (mixed)", () => {
  enum A {
    X1 = 0,
    X15 = "x15",
    X2 = 6,
  }

  expect(enumValues(A)).toEqual([0, "x15", 6])
})

test("enum (mixed)", () => {
  enum A {
    X1 = 0,
    X15 = "x15",
    X2 = 6,
  }

  const type = types.enum(A)

  assert(_ as TypeToData<typeof type>, _ as A)

  expectTypeCheckOk(type, A.X15)
  expectTypeCheckOk(type, A.X2)
  expectTypeCheckFail(type, "X1", [], `0 | "x15" | 6`)

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

    return rightResult
      ? null
      : new TypeCheckError({
          path: ["result"],
          expectedTypeName: "a+b",
          actualValue: sum.result,
          typeCheckedValue: sum,
        })
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

  expectTypeCheckOk(type, objectMap<number>([["1", 10]]))
  expectTypeCheckFail(type, {} as any, [], "ObjectMap<number>")
  expectTypeCheckFail(type, objectMap<string>([["1", "10"]]), ["items", "1"], "number")

  const validSnapshot = getSnapshot(
    objectMap<number>([
      ["1", 10],
      ["2", 20],
    ])
  )

  const throwingProcessorType = types.objectMap(types.or(types.string, types.number))
  const throwingProcessorTypeChecker = resolveTypeChecker(throwingProcessorType)
  const throwingSnapshot = getSnapshot(
    objectMap<string | number>([
      ["1", 10],
      ["2", "20"],
    ])
  )
  throwingProcessorTypeChecker.fromSnapshotProcessor(throwingSnapshot as any)
  expect(throwingProcessorTypeChecker.toSnapshotProcessor(throwingSnapshot as any)).toEqual(
    throwingSnapshot
  )

  const invalidSnapshot = {
    ...throwingSnapshot,
    items: {
      ...throwingSnapshot.items,
      bad: true,
    },
  }
  expect(() => throwingProcessorTypeChecker.fromSnapshotProcessor(invalidSnapshot as any)).toThrow(
    "snapshot does not match the following type: <string | number> - Path: / - Value: true"
  )
  expect(() => throwingProcessorTypeChecker.toSnapshotProcessor(invalidSnapshot as any)).toThrow(
    "snapshot does not match the following type: <string | number> - Path: / - Value: true"
  )

  const typeChecker = resolveTypeChecker(type)
  expect(typeChecker.snapshotType(5 as any)).toBeNull()
  expect(typeChecker.snapshotType({ [modelTypeKey]: validSnapshot[modelTypeKey] } as any)).toBe(
    typeChecker
  )
  expect(typeChecker.snapshotType({ items: { a: 1 } } as any)).toBe(typeChecker)
  expect(typeChecker.snapshotType({ items: { a: "1" } } as any)).toBeNull()

  const typeInfo = expectValidTypeInfo(type, ObjectMapTypeInfo)
  expect(typeInfo.valueType).toBe(types.number)
  expect(typeInfo.valueTypeInfo).toBe(getTypeInfo(types.number))
})

test("arraySet", () => {
  const type = types.arraySet(types.number)

  assert(_ as TypeToData<typeof type>, _ as ArraySet<number>)

  expectTypeCheckOk(type, arraySet<number>([1, 2, 3]))
  expectTypeCheckFail(type, {} as any, [], "ArraySet<number>")
  expectTypeCheckFail(type, arraySet<string | number>([1, 2, "3"]), ["items", 2], "number")

  const validSnapshot = getSnapshot(arraySet<number>([1, 2, 3]))

  const throwingProcessorType = types.arraySet(types.or(types.string, types.number))
  const throwingProcessorTypeChecker = resolveTypeChecker(throwingProcessorType)
  const throwingSnapshot = getSnapshot(arraySet<string | number>([1, "2"]))
  throwingProcessorTypeChecker.fromSnapshotProcessor(throwingSnapshot as any)
  expect(throwingProcessorTypeChecker.toSnapshotProcessor(throwingSnapshot as any)).toEqual(
    throwingSnapshot
  )

  const invalidSnapshot = {
    ...throwingSnapshot,
    items: [1, true],
  }
  expect(() => throwingProcessorTypeChecker.fromSnapshotProcessor(invalidSnapshot as any)).toThrow(
    "snapshot does not match the following type: <string | number> - Path: / - Value: true"
  )
  expect(() => throwingProcessorTypeChecker.toSnapshotProcessor(invalidSnapshot as any)).toThrow(
    "snapshot does not match the following type: <string | number> - Path: / - Value: true"
  )

  const typeChecker = resolveTypeChecker(type)
  expect(typeChecker.snapshotType(5 as any)).toBeNull()
  expect(typeChecker.snapshotType({ [modelTypeKey]: validSnapshot[modelTypeKey] } as any)).toBe(
    typeChecker
  )
  expect(typeChecker.snapshotType({ items: [1] } as any)).toBe(typeChecker)
  expect(typeChecker.snapshotType({ items: ["1"] } as any)).toBeNull()

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
  @testModel("syntaxSugar")
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
  const type = types.model(SS)
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
  expect(toJS(ss.arr)).toEqual([1, "2", 3])

  expectTypeCheckOk(type, ss)

  ss.setN("10" as any)
  expectTypeCheckFail(type, ss, ["n"], "number")
  ss.setN(42)

  ss.setS(10 as any)
  expectTypeCheckFail(type, ss, ["s"], "string")
  ss.setS("foo")

  ss.setB("10" as any)
  expectTypeCheckFail(type, ss, ["b"], "boolean")
  ss.setB(true)

  ss.setN2("10" as any)
  expectTypeCheckFail(type, ss, ["n2"], "number")
  ss.setN2(42)

  ss.setS2(10 as any)
  expectTypeCheckFail(type, ss, ["s2"], "string")
  ss.setS2("foo")

  ss.setB2("10" as any)
  expectTypeCheckFail(type, ss, ["b2"], "boolean")
  ss.setB2(true)

  ss.setNul(10 as any)
  expectTypeCheckFail(type, ss, ["nul"], "null")
  ss.setNul(null)

  ss.setUndef("10" as any)
  expectTypeCheckFail(type, ss, ["undef"], "undefined")
  ss.setUndef(undefined)

  expect(() => {
    ss.setOr({} as any)
    // expectTypeCheckFail(type, ss, ["or"], "string | number | boolean")
  }).toThrow(
    `snapshot does not match the following type: <string | number | boolean> - Path: / - Value: {}`
  )
  ss.setOr(5)
})

test("syntax sugar for union types in tProp", () => {
  @testModel("syntaxSugarOrArray")
  class SS extends Model({
    or: tProp([String, Number, Boolean]),
    orDefault: tProp([String, Number], "foo"),
    orDefaultFn: tProp([String, Number], () => 10),
    maybeString: tProp([String, undefined]),
  }) {
    @modelAction
    setOr(o: string | number | boolean) {
      this.or = o
    }

    @modelAction
    setOrDefault(o: string | number) {
      this.orDefault = o
    }

    @modelAction
    setOrDefaultFn(o: string | number) {
      this.orDefaultFn = o
    }

    @modelAction
    setMaybeString(v: string | undefined) {
      this.maybeString = v
    }
  }

  const ss = new SS({ or: 5, orDefault: undefined, orDefaultFn: null, maybeString: undefined })
  const type = types.model(SS)
  assert(_ as TypeToData<typeof type>, _ as SS)

  assert(ss.or, _ as string | number | boolean)
  assert(ss.orDefault, _ as string | number)
  assert(ss.orDefaultFn, _ as string | number)
  assert(ss.maybeString, _ as string | undefined)

  expect(ss.or).toBe(5)
  expect(ss.orDefault).toBe("foo")
  expect(ss.orDefaultFn).toBe(10)
  expect(ss.maybeString).toBe(undefined)

  expectTypeCheckOk(type, ss)

  expect(() => {
    ss.setOr({} as any)
  }).toThrow(
    `snapshot does not match the following type: <string | number | boolean> - Path: / - Value: {}`
  )
  ss.setOr(5)

  expect(() => {
    ss.setOrDefault(true as any)
  }).toThrow(
    `snapshot does not match the following type: <string | number> - Path: / - Value: true`
  )
  ss.setOrDefault("foo")

  expect(() => {
    ss.setOrDefaultFn(true as any)
  }).toThrow(
    `snapshot does not match the following type: <string | number> - Path: / - Value: true`
  )
  ss.setOrDefaultFn(10)

  expect(() => {
    ss.setMaybeString(5 as any)
  }).toThrow(
    `snapshot does not match the following type: <string | undefined> - Path: / - Value: 5`
  )
  ss.setMaybeString(undefined)
})

test("fromSnapshot union mismatch includes full path", () => {
  @testModel("issue #487/UnionModel")
  class UnionModel extends Model({
    value: tProp([String, Number]),
  }) {}

  expect(() => {
    fromSnapshot(UnionModel, {
      value: {},
    } as any)
  }).toThrow(
    `snapshot does not match the following type: <string | number> - Path: /value - Value: {}`
  )

  try {
    fromSnapshot(UnionModel, {
      value: {},
    } as any)
    throw new Error("expected fromSnapshot to throw")
  } catch (err) {
    const e = err as any
    expect(e).toBeInstanceOf(SnapshotTypeMismatchError)
    expect(e).toBeInstanceOf(MobxKeystoneError)
    expect(e.path).toEqual(["value"])
    expect(e.expectedTypeName).toBe("string | number")
    expect(e.actualValue).toEqual({})
  }
})

test("fromSnapshot deep type errors include full path and model trail metadata", () => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  @testModel("issue #487/TestModel3")
  class TestModel3 extends Model({
    test3_1: tProp(types.string),
  }) {}

  @testModel("issue #487/TestModel2")
  class TestModel2 extends Model({
    test2_1: tProp(types.string),
    test2_2: tProp(TestModel3),
  }) {}

  @testModel("issue #487/TestModel1")
  class TestModel1 extends Model({
    test1_1: tProp(types.string),
    test1_2: tProp(TestModel2),
  }) {}

  const badSnapshot = {
    test1_1: "ok",
    test1_2: {
      test2_1: "ok2",
      test2_2: {
        test3_1: 123,
      },
    },
  }

  const testName = expect.getState().currentTestName
  const expectedModelTrail = [
    `${testName}/issue #487/TestModel1`,
    `${testName}/issue #487/TestModel2`,
    `${testName}/issue #487/TestModel3`,
  ]

  expect(() => {
    fromSnapshot(TestModel1, badSnapshot as any)
  }).toThrow(
    `TypeCheckError: Expected a value of type <string> but got an incompatible value - Path: /test1_2/test2_2/test3_1 - Value: 123 - Model trail: ${expectedModelTrail.join(
      " -> "
    )}`
  )

  try {
    fromSnapshot(TestModel1, badSnapshot as any)
    throw new Error("expected fromSnapshot to throw")
  } catch (err) {
    const e = err as any
    expect(e.path).toEqual(["test1_2", "test2_2", "test3_1"])
    expect(e.expectedTypeName).toBe("string")
    expect(e.actualValue).toBe(123)
    expect(e.modelTrail).toEqual(expectedModelTrail)
  }

  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
  })
})

test("types.tag", () => {
  const testDisplayName = "Test"
  const tagData = { displayName: testDisplayName }

  @testModel("M")
  class M extends Model({
    p: tProp(types.tag(types.string, tagData, "someTypeName"), ""),
  }) {}

  const m = new M({})
  const type = types.model<typeof Model>(m.constructor)
  const modelTypeInfo = getTypeInfo(type) as ModelTypeInfo
  const propTypeInfo = modelTypeInfo.props.p.typeInfo as TagTypeInfo<{ displayName: string }>
  expect(propTypeInfo.tag).toBe(tagData)
  expect(propTypeInfo.typeName).toEqual("someTypeName")
})

test("issue #445", () => {
  @testModel("issue #445/Todo")
  class T extends Model({
    arrUnd: tProp(types.maybe(types.array(types.string))),
    arrNull: tProp(types.maybeNull(types.array(types.number))),
  }) {}

  const t1 = new T({ arrUnd: undefined, arrNull: null })
  expect(toJS(t1.arrUnd)).toEqual(undefined)
  expect(toJS(t1.arrNull)).toEqual(null)

  const t2 = new T({ arrUnd: [], arrNull: [] })
  expect(toJS(t2.arrUnd)).toEqual([])
  expect(toJS(t2.arrNull)).toEqual([])

  const t3 = new T({ arrUnd: ["5"], arrNull: [5] })
  expect(toJS(t3.arrUnd)).toEqual(["5"])
  expect(toJS(t3.arrNull)).toEqual([5])
})

test("issue #447", () => {
  @testModel("issue #447/Todo")
  class Todo extends Model({
    text: tProp(types.string),
  }) {
    @modelAction
    setText(text: string) {
      this.text = text
    }
  }

  @testModel("issue #447/TodoList1")
  class TodoList1 extends Model({
    todos: tProp(types.array(types.model(Todo)), () => []),
  }) {
    @modelAction
    add(todo: Todo) {
      this.todos.push(todo)
    }
  }

  @testModel("issue #447/TodoList2")
  class TodoList2 extends Model({
    todos: prop<Todo[]>(() => []),
  }) {
    @modelAction
    add(todo: Todo) {
      this.todos.push(todo)
    }
  }

  const todoList1 = new TodoList1({
    todos: [new Todo({ text: "first" })],
  })
  const todoList2 = new TodoList2({
    todos: [new Todo({ text: "first" })],
  })

  function normalizeSn<T>(sn: T): T {
    return {
      ...sn,
      $modelType: "",
    }
  }

  function expectSnapshotsToBeTheSame() {
    const sn1 = normalizeSn(getSnapshot(todoList1))
    const sn2 = normalizeSn(getSnapshot(todoList2))
    expect(sn1).toEqual(sn2)
  }

  expect(todoList1.todos.length).toBe(todoList2.todos.length)
  expectSnapshotsToBeTheSame()

  const snapshots1: any[] = []
  onSnapshot(todoList1, (sn) => snapshots1.push(normalizeSn(sn)))
  const snapshots2: any[] = []
  onSnapshot(todoList2, (sn) => snapshots2.push(normalizeSn(sn)))

  const todo1 = new Todo({ text: "second" })
  onSnapshot(todo1, (sn) => snapshots1.push(normalizeSn(sn)))
  const todo2 = new Todo({ text: "second" })
  onSnapshot(todo2, (sn) => snapshots2.push(normalizeSn(sn)))

  todoList1.add(todo1)
  todoList2.add(todo2)
  expect(todoList1.todos.length).toBe(todoList2.todos.length)
  expectSnapshotsToBeTheSame()
  expect(snapshots1).toEqual(snapshots2)

  todo1.setText("second edited")
  todo2.setText("second edited")
  expectSnapshotsToBeTheSame()
  expect(snapshots1).toEqual(snapshots2)
})

test("issue #448", () => {
  const todoRef = rootRef<Todo>("issue #448/TodoRef")

  @testModel("issue #448/Todo")
  class Todo extends Model({
    id: idProp,
    text: tProp(types.string, ""),
  }) {}

  @testModel("issue #448/TodoList")
  class TodoList extends Model({
    list: tProp(types.array(Todo), () => []),
    selectedRef: tProp(types.ref(todoRef)),
  }) {}

  fromSnapshot(TodoList, {
    list: [{ id: "id1", text: "Todo 1" }],
    selectedRef: {
      // $modelType should not be needed when using tProp
      // $modelType: "issue #448/TodoRef",
      id: "id1",
    },
  })
})

test("issue #454", () => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })

  @testModel("issue #454/MySubModel")
  class MySubModel extends Model({
    someData: tProp(types.number, 0),
  }) {}
  @testModel("issue #454/Todo")
  class Todo extends Model({
    text: tProp(types.string, "").withSetter(),
    arrayProp: tProp(types.array(types.number), () => []),
    subModel: tProp(MySubModel, () => new MySubModel({})),
  }) {}

  const todo1 = new Todo({})

  const todo2 = fromSnapshot(Todo, {})
  expect(getSnapshot(todo2)).toEqual(getSnapshot(todo1))

  // this should not throw since the default value will transform undefined to an empty string
  todo2.setText(undefined as any)

  const todo3 = fromSnapshot(Todo, {
    text: null,
    arrayProp: null,
    subModel: null,
  })
  expect(getSnapshot(todo3)).toEqual(getSnapshot(todo1))
})
