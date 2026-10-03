import {
  applySnapshot,
  customRef,
  DataModel,
  ExtendedModel,
  fromSnapshot,
  getGlobalConfig,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  model,
  SnapshotTypeMismatchError,
  setGlobalConfig,
  tProp,
  typeCheck,
  types,
} from "../../src"
// internal, used since which union branch is picked is otherwise not observable for plain models
import { resolveTypeChecker } from "../../src/types/resolveTypeChecker"

// https://github.com/xaviergonz/mobx-keystone/issues/590

@model("issue590/A")
class A extends Model({ a: tProp(types.number, 0) }) {}

@model("issue590/B")
class B extends Model({ b: tProp(types.string, "") }) {}

@model("issue590/ASub")
class ASub extends ExtendedModel(A, { extra: tProp(types.boolean, false) }) {}

@model("issue590/ASubSub")
class ASubSub extends ExtendedModel(ASub, { extra2: tProp(types.boolean, false) }) {}

@model("issue590/C")
class C extends Model({ c: tProp(types.number, 0) }) {}

@model("issue590/Parent")
class Parent extends Model({ child: tProp(types.model(A)) }) {}

const bSn = () => getSnapshot(new B({ b: "hi" })) as any

const expectMismatchFor = (modelName: string, fn: () => unknown) => {
  expect(fn).toThrow(SnapshotTypeMismatchError)
  expect(fn).toThrow(`<Model(${modelName})>`)
}

const expectMismatch = (fn: () => unknown) => expectMismatchFor("issue590/A", fn)

describe.each([ModelAutoTypeCheckingMode.AlwaysOn, ModelAutoTypeCheckingMode.AlwaysOff])(
  "modelAutoTypeChecking %s",
  (mode) => {
    let prevMode: ModelAutoTypeCheckingMode

    beforeEach(() => {
      prevMode = getGlobalConfig().modelAutoTypeChecking
      setGlobalConfig({ modelAutoTypeChecking: mode })
    })

    afterEach(() => {
      setGlobalConfig({ modelAutoTypeChecking: prevMode })
    })

    test("root model with an unrelated $modelType throws", () => {
      expectMismatch(() => fromSnapshot(A, bSn()))
      expectMismatch(() => fromSnapshot(types.model(A), bSn()))
    })

    test("same model and subclasses still load", () => {
      expect(fromSnapshot(A, getSnapshot(new A({ a: 1 })))).toBeInstanceOf(A)
      expect(fromSnapshot(A, getSnapshot(new ASub({})))).toBeInstanceOf(ASub)
      expect(fromSnapshot(A, getSnapshot(new ASubSub({})))).toBeInstanceOf(ASubSub)
      expect(fromSnapshot(A, { a: 2 })).toBeInstanceOf(A)
    })

    test("a superclass snapshot does not load as a subclass", () => {
      expect(() => fromSnapshot(ASub, getSnapshot(new A({})) as any)).toThrow(
        SnapshotTypeMismatchError
      )
    })

    test("nested inside model props", () => {
      expectMismatch(() => fromSnapshot(Parent, { child: bSn() }))
      expect(fromSnapshot(Parent, { child: getSnapshot(new ASub({})) }).child).toBeInstanceOf(ASub)
    })

    test("nested inside containers", () => {
      expectMismatch(() => fromSnapshot(types.array(types.model(A)), [bSn()]))
      expectMismatch(() => fromSnapshot(types.record(types.model(A)), { x: bSn() }))
      expectMismatch(() => fromSnapshot(types.maybe(types.model(A)), bSn()))
      expectMismatch(() =>
        fromSnapshot(
          types.object(() => ({ x: types.model(A) })),
          { x: bSn() }
        )
      )

      const arr = fromSnapshot(types.array(types.model(A)), [
        getSnapshot(new A({})),
        getSnapshot(new ASub({})),
      ])
      expect(arr[1]).toBeInstanceOf(ASub)
    })

    test("applySnapshot with an unrelated nested model throws and leaves the tree untouched", () => {
      const p = new Parent({ child: new A({ a: 1 }) })
      const before = getSnapshot(p)
      expectMismatch(() => applySnapshot(p, { ...before, child: bSn() }))
      expect(getSnapshot(p)).toBe(before)

      applySnapshot(p, { ...before, child: getSnapshot(new ASub({ a: 2 })) })
      expect(p.child).toBeInstanceOf(ASub)
      expect(p.child.a).toBe(2)
    })

    test("unions dispatch subclass snapshots to the base model type", () => {
      const t = types.or(types.model(A), types.model(B))
      expect(fromSnapshot(t, getSnapshot(new ASub({})))).toBeInstanceOf(ASub)
      expect(fromSnapshot(t, getSnapshot(new ASubSub({})))).toBeInstanceOf(ASubSub)
      expect(fromSnapshot(t, bSn())).toBeInstanceOf(B)
      expect(() => fromSnapshot(t, getSnapshot(new C({})) as any)).toThrow(
        SnapshotTypeMismatchError
      )
    })

    test("untyped fromSnapshot still uses $modelType", () => {
      expect(fromSnapshot<A>(bSn())).toBeInstanceOf(B)
    })
  }
)

const withGlobalConfig = (config: Parameters<typeof setGlobalConfig>[0], fn: () => void) => {
  const prevConfig = { ...getGlobalConfig() }
  setGlobalConfig(config)
  try {
    fn()
  } finally {
    setGlobalConfig(prevConfig)
  }
}

test("subclasses are accepted across hot-reloaded model registrations", () => {
  withGlobalConfig({ showDuplicateModelNameWarnings: false }, () => {
    @model("issue590/hmr/Base")
    class OldBase extends Model({ a: tProp(types.number, 0) }) {}

    // still extends the previous registration of the base model
    @model("issue590/hmr/OldSub")
    class OldSub extends ExtendedModel(OldBase, { x: tProp(types.number, 0) }) {}

    // hot reload re-registers the base model under the same name
    @model("issue590/hmr/Base")
    class NewBase extends Model({ a: tProp(types.number, 0) }) {}

    @model("issue590/hmr/NewSub")
    class NewSub extends ExtendedModel(NewBase, { y: tProp(types.number, 0) }) {}

    expect(fromSnapshot(NewBase, getSnapshot(new OldSub({})))).toBeInstanceOf(OldSub)
    expect(fromSnapshot(OldBase, getSnapshot(new NewSub({})))).toBeInstanceOf(NewSub)
    expect(
      fromSnapshot(types.array(types.model(NewBase)), [getSnapshot(new OldSub({}))])[0]
    ).toBeInstanceOf(OldSub)
    expect(
      fromSnapshot(types.or(types.model(NewBase), types.model(B)), getSnapshot(new OldSub({})))
    ).toBeInstanceOf(OldSub)
    expectMismatchFor("issue590/hmr/Base", () => fromSnapshot(NewBase, bSn()))

    // a name that is registered again as an unrelated model is no longer accepted
    @model("issue590/hmr/Reloaded")
    class ReloadedSub extends ExtendedModel(NewBase, {}) {}
    const reloadedSn = getSnapshot(new ReloadedSub({}))
    expect(fromSnapshot(NewBase, reloadedSn)).toBeInstanceOf(ReloadedSub)

    @model("issue590/hmr/Reloaded")
    class ReloadedUnrelated extends Model({ a: tProp(types.number, 0) }) {}
    expectMismatchFor("issue590/hmr/Base", () => fromSnapshot(NewBase, reloadedSn))
    expect(fromSnapshot(ReloadedUnrelated, reloadedSn as any)).toBeInstanceOf(ReloadedUnrelated)

    // instance type checking also compares registered names
    expect(typeCheck(types.model(NewBase), new OldSub({}))).toBeNull()
    expect(typeCheck(types.model(OldBase), new NewSub({}))).toBeNull()
    expect(typeCheck(types.model(OldBase), new NewBase({}))).toBeNull()
    expect(typeCheck(types.model(NewBase), new B({}) as any)).not.toBeNull()
    expect(typeCheck(types.model(OldSub), new OldBase({}) as any)).not.toBeNull()

    @model("issue590/hmr/Holder")
    class Holder extends Model({ child: tProp(types.maybe(types.model(NewBase))) }) {}

    withGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn }, () => {
      expect(new Holder({ child: new OldSub({}) }).child).toBeInstanceOf(OldSub)
    })
  })
})

describe("unions prefer the branches of the closest models", () => {
  const aType = types.model(A)
  const aSubType = types.model(ASub)
  const bType = types.model(B)
  const aSn = getSnapshot(new A({}))
  const aSubSn = getSnapshot(new ASub({}))
  const aSubSubSn = getSnapshot(new ASubSub({}))
  const snapshotTypeOf = (type: any, sn: unknown) => resolveTypeChecker(type).snapshotType(sn)

  test("exact model branches first, then the closest base model", () => {
    for (const t of [types.or(aType, aSubType), types.or(aSubType, aType)]) {
      expect(snapshotTypeOf(t, aSn)).toBe(resolveTypeChecker(aType))
      expect(snapshotTypeOf(t, aSubSn)).toBe(resolveTypeChecker(aSubType))
      // no exact branch, so the closest base model (ASub) is used rather than A
      expect(snapshotTypeOf(t, aSubSubSn)).toBe(resolveTypeChecker(aSubType))
      expect(fromSnapshot(t, aSubSubSn)).toBeInstanceOf(ASubSub)
    }
  })

  test("through wrappers and nested in other types", () => {
    const aArray = types.array(aType)
    const aSubArray = types.array(types.refinement(aSubType, () => true))
    const t = types.or(aArray, aSubArray)
    expect(snapshotTypeOf(t, [aSn])).toBe(resolveTypeChecker(aArray))
    expect(snapshotTypeOf(t, [aSubSn])).toBe(resolveTypeChecker(aSubArray))
    expect(snapshotTypeOf(t, [aSubSubSn])).toBe(resolveTypeChecker(aSubArray))

    // the closest branch overall wins
    const objAA = types.object(() => ({ x: aType, y: aType }))
    const objASubA = types.object(() => ({ x: aSubType, y: aType }))
    const objSn = { x: aSubSubSn, y: aSubSn }
    expect(snapshotTypeOf(types.or(objAA, objASubA), objSn)).toBe(resolveTypeChecker(objASubA))
    expect(snapshotTypeOf(types.or(objASubA, objAA), objSn)).toBe(resolveTypeChecker(objASubA))
  })

  test("nested unions", () => {
    const inner = types.or(aType, bType)
    const t = types.or(inner, aSubType)
    expect(snapshotTypeOf(t, aSubSn)).toBe(resolveTypeChecker(aSubType))
    expect(snapshotTypeOf(t, aSn)).toBe(resolveTypeChecker(aType))

    // single option unions (maybe) inside unions
    const tMaybe = types.or(types.maybe(aType), aSubType)
    expect(snapshotTypeOf(tMaybe, aSubSn)).toBe(resolveTypeChecker(aSubType))
    expect(snapshotTypeOf(tMaybe, aSn)).toBe(resolveTypeChecker(aType))
    expect(snapshotTypeOf(tMaybe, aSubSubSn)).toBe(resolveTypeChecker(aSubType))
    expect(fromSnapshot(tMaybe, aSubSubSn)).toBeInstanceOf(ASubSub)

    // a single option union that does not accept the snapshot model lets other branches match
    for (const t2 of [
      types.or(types.maybe(aType), bType),
      types.or(types.maybe(bType), aType),
      types.or(types.maybeNull(aType), types.maybe(bType)),
    ]) {
      expect(fromSnapshot(t2, bSn())).toBeInstanceOf(B)
      expect(fromSnapshot(t2, aSn)).toBeInstanceOf(A)
      expect(fromSnapshot(t2, aSubSn)).toBeInstanceOf(ASub)
      expect(() => fromSnapshot(t2, getSnapshot(new C({})) as any)).toThrow(
        SnapshotTypeMismatchError
      )
    }
    expect(fromSnapshot(types.or(types.maybe(bType), aSubType), aSubSubSn)).toBeInstanceOf(ASubSub)

    // also when nested in other types
    const nested = types.or(
      types.object(() => ({ v: types.maybe(bType) })),
      types.object(() => ({ v: types.maybe(aType) }))
    )
    expect(fromSnapshot(nested, { v: aSn } as any).v).toBeInstanceOf(A)
    expect(fromSnapshot(nested, { v: aSubSn } as any).v).toBeInstanceOf(ASub)

    // models nested in single option unions take part in the outer union preference too
    const oA = types.object(() => ({ x: aType, t: types.number }))
    const oASub = types.object(() => ({ x: aSubType, t: types.dateAsTimestamp }))
    const oSn = { x: aSubSn, t: 1000 }
    for (const t2 of [
      types.or(oA, oASub),
      types.or(types.maybe(oA), oASub),
      types.or(types.maybe(oA), types.maybeNull(oASub)),
    ]) {
      expect(fromSnapshot(t2, oSn)!.t).toBeInstanceOf(Date)
    }
    const arrays = types.or(types.maybe(types.array(oA)), types.array(oASub))
    expect(fromSnapshot(arrays, [oSn])![0].t).toBeInstanceOf(Date)
    expect(fromSnapshot(types.or(types.maybe(oA), oASub), { x: aSn, t: 1 })!.t).toBe(1)
    // single option unions that do not match the snapshot are still accepted when no branch is
    // closer (as before)
    const oNoModel = types.object(() => ({ n: types.number }))
    expect(snapshotTypeOf(types.or(types.maybe(oNoModel), oASub), { x: aSubSn })).toBe(
      resolveTypeChecker(oNoModel)
    )
  })

  test("the first branch wins on ties", () => {
    const o1 = types.object(() => ({ x: aType }))
    const o2 = types.object(() => ({ x: aType }))
    for (const sn of [{ x: aSn }, { x: aSubSn }]) {
      expect(snapshotTypeOf(types.or(o1, o2), sn)).toBe(resolveTypeChecker(o1))
      expect(snapshotTypeOf(types.or(o2, o1), sn)).toBe(resolveTypeChecker(o2))
    }
  })

  test("refs in unions", () => {
    const aRef = customRef<A>("issue590/unionARef", { resolve: () => undefined })
    const t = types.or(types.ref(aRef), aType)
    expect(fromSnapshot(t, getSnapshot(aRef("x")))).toMatchObject({ id: "x" })
    expect(fromSnapshot(t, aSubSn)).toBeInstanceOf(ASub)
    expect(() => fromSnapshot(t, bSn())).toThrow(SnapshotTypeMismatchError)
  })

  test("single option unions with nested models of other registered models let other branches match", () => {
    const oA = types.object(() => ({ x: aType }))
    const oB = types.object(() => ({ x: bType }))
    const t = types.or(types.maybe(oA), oB)
    expect(fromSnapshot(t, { x: bSn() })!.x).toBeInstanceOf(B)
    expect(fromSnapshot(t, { x: aSubSn })!.x).toBeInstanceOf(ASub)
    expect(() => fromSnapshot(t, { x: getSnapshot(new C({})) } as any)).toThrow(
      SnapshotTypeMismatchError
    )

    const arrays = types.or(types.maybe(types.array(oA)), types.array(oB))
    expect(fromSnapshot(arrays, [{ x: bSn() }])![0].x).toBeInstanceOf(B)

    const aRef = customRef<A>("issue590/nestedARef", { resolve: () => undefined })
    const bRef = customRef<B>("issue590/nestedBRef", { resolve: () => undefined })
    const refs = types.or(
      types.maybe(types.object(() => ({ r: types.ref(aRef) }))),
      types.object(() => ({ r: types.ref(bRef) }))
    )
    expect(fromSnapshot(refs, { r: getSnapshot(bRef("x")) })!.r).toBeInstanceOf(bRef.refClass)
    expect(fromSnapshot(refs, { r: getSnapshot(aRef("x")) })!.r).toBeInstanceOf(aRef.refClass)
  })

  test("dispatcher unions", () => {
    const t = types.or(() => aType, aType, bType)
    expect(fromSnapshot(t, aSubSn)).toBeInstanceOf(ASub)
    expectMismatch(() => fromSnapshot(t, bSn()))
  })

  test("unions with codec branches", () => {
    @model("issue590/CodecHolder")
    class CodecHolder extends Model({ v: tProp(types.or(aType, types.dateAsTimestamp)) }) {}

    expect(fromSnapshot(CodecHolder, { v: aSubSn }).v).toBeInstanceOf(ASub)
    expect(fromSnapshot(CodecHolder, { v: 1000 }).v).toEqual(new Date(1000))
    expect(new CodecHolder({ v: new ASub({}) }).v).toBeInstanceOf(ASub)
    expect(() => fromSnapshot(CodecHolder, { v: bSn() })).toThrow(SnapshotTypeMismatchError)
  })

  test("codec user code inside a union match is not affected by the outer match", () => {
    const innerUnion = types.or(aType, bType)
    let innerResult: unknown
    const probe = types.codec({
      typeName: "probe",
      encodedType: types.object(() => ({ probe: types.number })),
      is(_value): _value is { probe: number } {
        // user code that loads a subclass snapshot into another union
        innerResult = fromSnapshot(innerUnion, aSubSn)
        return false
      },
      transform: ({ originalValue }) => originalValue,
      untransform: ({ transformedValue }) => transformedValue,
    })

    expect(snapshotTypeOf(types.or(probe, aType), aSubSn)).toBe(resolveTypeChecker(aType))
    expect(innerResult).toBeInstanceOf(ASub)

    // subclasses rejected by that user code do not make the outer match reject a single option
    // union that is otherwise accepted
    const oProbe = types.object(() => ({ p: probe }))
    const oOther = types.object(() => ({ q: types.number }))
    innerResult = undefined
    expect(snapshotTypeOf(types.or(types.maybe(oProbe), oOther), { p: { probe: 1 } })).toBe(
      resolveTypeChecker(oProbe)
    )
    expect(innerResult).toBeInstanceOf(ASub)
  })
})

@model("issue590/DM")
class DM extends DataModel({ child: tProp(types.model(A)) }) {}

test("models nested in data models", () => {
  expectMismatch(() => fromSnapshot(types.dataModelData(DM), { child: bSn() }))
  expect(
    fromSnapshot(types.dataModelData(DM), { child: getSnapshot(new ASub({})) } as any).child
  ).toBeInstanceOf(ASub)
})

@model("issue590/WithConstructorProp")
class WithConstructorProp extends Model({ constructor: tProp(types.number, 0) }) {}

@model("issue590/WithConstructorPropSub")
class WithConstructorPropSub extends ExtendedModel(WithConstructorProp, {}) {}

test("models with a prop named constructor", () => {
  const instance = new WithConstructorProp({ constructor: 1 })
  const subInstance = new WithConstructorPropSub({ constructor: 1 })
  expect(typeCheck(types.model(A), instance as any)).not.toBeNull()
  expect(typeCheck(types.model(WithConstructorProp), subInstance)).toBeNull()
  expect(fromSnapshot(types.model(WithConstructorProp), getSnapshot(subInstance))).toBeInstanceOf(
    WithConstructorPropSub
  )
})

test("refs with an unrelated $modelType throw", () => {
  const aRef = customRef<A>("issue590/aRef", { resolve: () => undefined })
  const refType = types.ref(aRef)

  const ref = fromSnapshot(refType, getSnapshot(aRef("x")))
  expect(ref.id).toBe("x")
  expect(() => fromSnapshot(refType, bSn())).toThrow(SnapshotTypeMismatchError)
  expect(() => fromSnapshot(types.array(refType), [bSn()])).toThrow(SnapshotTypeMismatchError)

  // instance type checking compares registered names (hot reloading)
  withGlobalConfig({ showDuplicateModelNameWarnings: false }, () => {
    const reloadedARef = customRef<A>("issue590/aRef", { resolve: () => undefined })
    expect(typeCheck(refType, reloadedARef("y"))).toBeNull()
    expect(typeCheck(refType, new B({}) as any)).not.toBeNull()
  })
})
