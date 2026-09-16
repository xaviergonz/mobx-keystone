import { expectTypeOf } from "expect-type"
import {
  Model,
  ModelAutoTypeCheckingMode,
  prop,
  setGlobalConfig,
  type TypeToData,
  tProp,
  types,
} from "../../src"
import { testModel } from "../utils"

beforeEach(() => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
})

test("self recursive", () => {
  @testModel("myApp/TreeNode")
  class TreeNode extends Model({ children: prop<TreeNode[]>(() => []), x: prop(0) }) {}

  const tn = new TreeNode({ children: [new TreeNode({})] })

  expectTypeOf(tn).toEqualTypeOf<TreeNode>()
  expectTypeOf(tn.x).toEqualTypeOf<number>()
  expectTypeOf(tn.children).toEqualTypeOf<TreeNode[]>()
  expectTypeOf(tn.children[0]).toEqualTypeOf<TreeNode>()
  expectTypeOf(tn.children[0].x).toEqualTypeOf<number>()
  expectTypeOf(tn.children[0].children).toEqualTypeOf<TreeNode[]>()

  expect(tn.children[0] instanceof TreeNode).toBeTruthy()
})

test("self recursive type checked", () => {
  @testModel("myAppTC/TreeNode")
  class TreeNode extends Model({
    children: tProp(types.array(types.model<TreeNode>(() => TreeNode)), () => []),
    x: tProp(types.number, 0),
  }) {}

  const tn = new TreeNode({ children: [new TreeNode({})] })

  expectTypeOf(tn).toEqualTypeOf<TreeNode>()
  expectTypeOf(tn.x).toEqualTypeOf<number>()
  expectTypeOf(tn.children).toEqualTypeOf<TreeNode[]>()
  expectTypeOf(tn.children[0]).toEqualTypeOf<TreeNode>()
  expectTypeOf(tn.children[0].x).toEqualTypeOf<number>()
  expectTypeOf(tn.children[0].children).toEqualTypeOf<TreeNode[]>()

  expect(tn.children[0] instanceof TreeNode).toBeTruthy()
})

test("cross-referenced", () => {
  @testModel("myApp/A")
  class A extends Model({ b: prop<B | undefined>(), x: prop(0) }) {}

  @testModel("myApp/B")
  class B extends Model({ a: prop<A | undefined>(), y: prop("") }) {}

  const a = new A({
    b: new B({
      a: new A({}),
    }),
  })

  expectTypeOf(a).toEqualTypeOf<A>()
  expectTypeOf(a.x).toEqualTypeOf<number>()
  expectTypeOf(a.b).toEqualTypeOf<B | undefined>()
  expectTypeOf(a.b!.y).toEqualTypeOf<string>()
  expectTypeOf(a.b!.a).toEqualTypeOf<A | undefined>()
  expectTypeOf(a.b!.a!.x).toEqualTypeOf<number>()

  expect(a.b!.a instanceof A).toBeTruthy()
})

test("cross-referenced type checked", () => {
  @testModel("myAppTC/A")
  class A extends Model({
    b: tProp(types.maybe(types.model<B>(() => B))),
    x: tProp(types.number, 0),
  }) {}

  @testModel("myAppTC/B")
  class B extends Model({
    a: tProp(types.maybe(types.model<A>(() => A))),
    y: tProp(types.string, ""),
  }) {}

  const a = new A({
    b: new B({
      a: new A({}),
    }),
  })

  expectTypeOf(a).toEqualTypeOf<A>()
  expectTypeOf(a.x).toEqualTypeOf<number>()
  expectTypeOf(a.b).toEqualTypeOf<B | undefined>()
  expectTypeOf(a.b!.y).toEqualTypeOf<string>()
  expectTypeOf(a.b!.a).toEqualTypeOf<A | undefined>()
  expectTypeOf(a.b!.a!.x).toEqualTypeOf<number>()

  expect(a.b!.a instanceof A).toBeTruthy()
})

test("recursive with object", () => {
  interface Obj {
    aa?: AA
    meObj?: Obj
  }

  @testModel("myApp/AA")
  class AA extends Model({
    obj: prop<Obj | undefined>(),
  }) {}

  const aa = new AA({
    obj: {
      aa: new AA({}),
      meObj: { aa: new AA({}) },
    },
  })

  expectTypeOf(aa).toEqualTypeOf<AA>()
  expectTypeOf(aa.obj).toEqualTypeOf<Obj | undefined>()
  expectTypeOf(aa.obj!.aa).toEqualTypeOf<AA | undefined>()
  expectTypeOf(aa.obj!.meObj).toEqualTypeOf<Obj | undefined>()
  expectTypeOf(aa.obj!.meObj!.aa).toEqualTypeOf<AA | undefined>()

  expect(aa.obj!.meObj!.aa instanceof AA).toBeTruthy()
})

test("recursive with object type checked", () => {
  const typeObj = types.object(() => ({
    aa: types.maybe(types.model<AA>(() => AA)),
    meObj: types.maybe(typeObj),
    x: types.maybe(types.number),
  }))

  type Obj2 = TypeToData<typeof typeObj>

  @testModel("myAppTC/AA")
  class AA extends Model({
    obj: tProp(types.maybe(typeObj)),
  }) {}

  const aa = new AA({
    obj: {
      aa: new AA({}),
      meObj: { aa: new AA({}) },
    },
  })

  expectTypeOf(aa).toEqualTypeOf<AA>()
  expectTypeOf(aa.obj).toEqualTypeOf<Obj2 | undefined>()
  expectTypeOf(aa.obj!.aa).toEqualTypeOf<AA | undefined>()
  expectTypeOf(aa.obj!.meObj).toEqualTypeOf<Obj2 | undefined>()
  expectTypeOf(aa.obj!.meObj!.aa).toEqualTypeOf<AA | undefined>()

  expect(aa.obj!.meObj!.aa instanceof AA).toBeTruthy()
})
