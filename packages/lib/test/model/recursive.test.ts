import { assert, _ } from "spec.ts"
import {
  Model,
  model,
  ModelAutoTypeCheckingMode,
  newModel,
  prop,
  setGlobalConfig,
  tProp,
  types,
  TypeToData,
} from "../../src"
import "../commonSetup"

beforeEach(() => {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn,
  })
})

test("self recursive", () => {
  @model("myApp/TreeNode")
  class TreeNode extends Model({ children: prop<TreeNode[]>(() => []), x: prop(0) }) {}

  const tn = newModel(TreeNode, { children: [newModel(TreeNode, {})] })

  assert(tn, _ as TreeNode)
  assert(tn.x, _ as number)
  assert(tn.children, _ as TreeNode[])
  assert(tn.children[0], _ as TreeNode)
  assert(tn.children[0].x, _ as number)
  assert(tn.children[0].children, _ as TreeNode[])

  expect(tn.children[0] instanceof TreeNode).toBeTruthy()
})

test("self recursive type checked", () => {
  @model("myAppTC/TreeNode")
  class TreeNode extends Model({
    children: tProp(types.array(types.model<TreeNode>(() => TreeNode)), () => []),
    x: tProp(types.number, 0),
  }) {}

  const tn = newModel(TreeNode, { children: [newModel(TreeNode, {})] })

  assert(tn, _ as TreeNode)
  assert(tn.x, _ as number)
  assert(tn.children, _ as TreeNode[])
  assert(tn.children[0], _ as TreeNode)
  assert(tn.children[0].x, _ as number)
  assert(tn.children[0].children, _ as TreeNode[])

  expect(tn.children[0] instanceof TreeNode).toBeTruthy()
})

test("cross-referenced", () => {
  @model("myApp/A")
  class A extends Model({ b: prop<B | undefined>(), x: prop(0) }) {}

  @model("myApp/B")
  class B extends Model({ a: prop<A | undefined>(), y: prop("") }) {}

  const a = newModel(A, {
    b: newModel(B, {
      a: newModel(A, {}),
    }),
  })

  assert(a, _ as A)
  assert(a.x, _ as number)
  assert(a.b, _ as B | undefined)
  assert(a.b!.y, _ as string)
  assert(a.b!.a, _ as A | undefined)
  assert(a.b!.a!.x, _ as number)

  expect(a.b!.a instanceof A).toBeTruthy()
})

test("cross-referenced type checked", () => {
  @model("myAppTC/A")
  class A extends Model({
    b: tProp(types.maybe(types.model<B>(() => B))),
    x: tProp(types.number, 0),
  }) {}

  @model("myAppTC/B")
  class B extends Model({
    a: tProp(types.maybe(types.model<A>(() => A))),
    y: tProp(types.string, ""),
  }) {}

  const a = newModel(A, {
    b: newModel(B, {
      a: newModel(A, {}),
    }),
  })

  assert(a, _ as A)
  assert(a.x, _ as number)
  assert(a.b, _ as B | undefined)
  assert(a.b!.y, _ as string)
  assert(a.b!.a, _ as A | undefined)
  assert(a.b!.a!.x, _ as number)

  expect(a.b!.a instanceof A).toBeTruthy()
})

test("recursive with object", () => {
  interface Obj {
    aa?: AA
    meObj?: Obj
  }

  @model("myApp/AA")
  class AA extends Model({
    obj: prop<Obj | undefined>(),
  }) {}

  const aa = newModel(AA, {
    obj: {
      aa: newModel(AA, {}),
      meObj: { aa: newModel(AA, {}) },
    },
  })

  assert(aa, _ as AA)
  assert(aa.obj, _ as Obj | undefined)
  assert(aa.obj!.aa, _ as AA | undefined)
  assert(aa.obj!.meObj, _ as Obj | undefined)
  assert(aa.obj!.meObj!.aa, _ as AA | undefined)

  expect(aa.obj!.meObj!.aa instanceof AA).toBeTruthy()
})

test("recursive with object type checked", () => {
  const typeObj = types.object(() => ({
    aa: types.maybe(types.model<AA>(() => AA)),
    meObj: types.maybe(typeObj),
    x: types.maybe(types.number),
  }))

  type Obj2 = TypeToData<typeof typeObj>

  @model("myAppTC/AA")
  class AA extends Model({
    obj: tProp(types.maybe(typeObj)),
  }) {}

  const aa = newModel(AA, {
    obj: {
      aa: newModel(AA, {}),
      meObj: { aa: newModel(AA, {}) },
    },
  })

  assert(aa, _ as AA)
  assert(aa.obj, _ as Obj2 | undefined)
  assert(aa.obj!.aa, _ as AA | undefined)
  assert(aa.obj!.meObj, _ as Obj2 | undefined)
  assert(aa.obj!.meObj!.aa, _ as AA | undefined)

  expect(aa.obj!.meObj!.aa instanceof AA).toBeTruthy()
})
