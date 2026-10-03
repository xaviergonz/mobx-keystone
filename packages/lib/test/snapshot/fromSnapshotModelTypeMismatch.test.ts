import {
  ExtendedModel,
  fromSnapshot,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  model,
  SnapshotTypeMismatchError,
  setGlobalConfig,
  tProp,
  types,
} from "../../src"

// https://github.com/xaviergonz/mobx-keystone/issues/590

@model("issue590/A")
class A extends Model({ a: tProp(types.number, 0) }) {}

@model("issue590/B")
class B extends Model({ b: tProp(types.string, "") }) {}

@model("issue590/ASub")
class ASub extends ExtendedModel(A, { extra: tProp(types.boolean, false) }) {}

@model("issue590/ASubSub")
class ASubSub extends ExtendedModel(ASub, { extra2: tProp(types.boolean, false) }) {}

@model("issue590/Parent")
class Parent extends Model({ child: tProp(types.model(A)) }) {}

const bSn = () => getSnapshot(new B({ b: "hi" })) as any

const expectMismatch = (fn: () => unknown) => {
  expect(fn).toThrow(SnapshotTypeMismatchError)
  expect(fn).toThrow("<Model(issue590/A)>")
}

describe.each([ModelAutoTypeCheckingMode.AlwaysOn, ModelAutoTypeCheckingMode.AlwaysOff])(
  "modelAutoTypeChecking %s",
  (mode) => {
    beforeEach(() => {
      setGlobalConfig({ modelAutoTypeChecking: mode })
    })

    afterEach(() => {
      setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.DevModeOnly })
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

    test("untyped fromSnapshot still uses $modelType", () => {
      expect(fromSnapshot<A>(bSn())).toBeInstanceOf(B)
    })
  }
)
