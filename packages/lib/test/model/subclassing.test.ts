import { computed } from "mobx"
import { _, assert } from "spec.ts"
import {
  ExtendedModel,
  Model,
  ModelClassDeclaration,
  ModelCreationData,
  ModelData,
  _async,
  _await,
  fromSnapshot,
  getSnapshot,
  idProp,
  modelAction,
  modelClass,
  modelFlow,
  prop,
  tProp,
  types,
} from "../../src"
import { Flatten } from "../../src/utils/types"
import { testModel } from "../utils"

// @testModel("P")
class P extends Model({
  x: tProp(types.number, 15),
  y: tProp(types.number, 10),
  z: tProp(types.number, 30),
}) {
  pMethod() {
    return "p"
  }

  sharedMethod() {
    return "p"
  }

  get sum() {
    return this.x + this.y + this.z
  }

  @modelAction
  setX(x: number) {
    this.x = x
  }
}

test("subclassing with additional props", () => {
  @testModel("P2_props")
  class P2 extends ExtendedModel(P, {
    a: tProp(types.number, 50),
    b: tProp(types.number),
  }) {
    p2Method() {
      return "p2"
    }

    sharedMethod() {
      return super.sharedMethod() + "2"
    }

    @computed
    get sum() {
      return super.sum + this.a + this.b
    }
  }

  type D = ModelData<P2>
  type CD = ModelCreationData<P2>
  assert(
    _ as D,
    _ as {
      x: number
      y: number
      z: number
      a: number
      b: number
    }
  )
  assert(
    _ as Flatten<CD>,
    _ as {
      x?: number | null | undefined
      y?: number | null | undefined
      z?: number | null | undefined
      a?: number | null | undefined
      b: number
    }
  )

  const p2 = new P2({ x: 20, b: 70 })

  assert(p2.a, _ as number)
  assert(p2.b, _ as number)
  assert(p2.x, _ as number)
  assert(p2.y, _ as number)
  assert(p2.z, _ as number)

  expect(p2.a).toBe(50)
  expect(p2.b).toBe(70)
  expect(p2.x).toBe(20)
  expect(p2.y).toBe(10)
  expect(p2.z).toBe(30)

  expect(p2.sum).toBe(p2.a + p2.b + p2.x + p2.y + p2.z)
  expect(p2.pMethod()).toBe("p")
  expect(p2.p2Method()).toBe("p2")
  expect(p2.sharedMethod()).toBe("p2")

  const p2sn = getSnapshot(p2)
  expect(p2sn).toMatchInlineSnapshot(`
    {
      "$modelType": "subclassing with additional props/P2_props",
      "a": 50,
      "b": 70,
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot(P2, p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})

test("subclassing without additional props", () => {
  @testModel("P2_noprops")
  class P2 extends ExtendedModel(P, {}) {
    p2Method() {
      return "p2"
    }

    sharedMethod() {
      return super.sharedMethod() + "2"
    }
  }

  type D = ModelData<P2>
  type CD = ModelCreationData<P2>
  assert(
    _ as D,
    _ as {
      x: number
      y: number
      z: number
    }
  )
  assert(
    _ as Flatten<CD>,
    _ as {
      x?: number | null | undefined
      y?: number | null | undefined
      z?: number | null | undefined
    }
  )

  const p2 = new P2({ x: 20 })

  assert(p2.x, _ as number)
  assert(p2.y, _ as number)
  assert(p2.z, _ as number)

  expect(p2.x).toBe(20)
  expect(p2.y).toBe(10)
  expect(p2.z).toBe(30)

  expect(p2.pMethod()).toBe("p")
  expect(p2.p2Method()).toBe("p2")
  expect(p2.sharedMethod()).toBe("p2")

  const p2sn = getSnapshot(p2)
  expect(p2sn).toMatchInlineSnapshot(`
    {
      "$modelType": "subclassing without additional props/P2_noprops",
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot(P2, p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})

test("subclassing without anything new", () => {
  @testModel("P2_nothingNew")
  class P2 extends ExtendedModel(P, {}) {}

  type D = ModelData<P2>
  type CD = ModelCreationData<P2>
  assert(
    _ as D,
    _ as {
      x: number
      y: number
      z: number
    }
  )
  assert(
    _ as Flatten<CD>,
    _ as {
      x?: number | null
      y?: number | null
      z?: number | null
    }
  )

  const p2 = new P2({ x: 20 })

  assert(p2.x, _ as number)
  assert(p2.y, _ as number)
  assert(p2.z, _ as number)

  expect(p2.x).toBe(20)
  expect(p2.y).toBe(10)
  expect(p2.z).toBe(30)

  expect(p2.pMethod()).toBe("p")
  expect(p2.sharedMethod()).toBe("p")

  const p2sn = getSnapshot(p2)
  expect(p2sn).toMatchInlineSnapshot(`
    {
      "$modelType": "subclassing without anything new/P2_nothingNew",
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot(P2, p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})

test("three level subclassing", () => {
  class P1 extends ExtendedModel(P, {
    a: tProp(types.number, 50),
  }) {
    p2Method() {
      return "p1"
    }

    sharedMethod() {
      return super.sharedMethod() + "1"
    }
  }

  @testModel("P2_threeLevels")
  class P2 extends ExtendedModel(P1, {
    b: tProp(types.number),
  }) {
    p2Method() {
      return "p2"
    }

    sharedMethod() {
      return super.sharedMethod() + "2"
    }

    @modelAction
    setB(b: number) {
      this.b = b
    }
  }

  type D = ModelData<P2>
  type CD = ModelCreationData<P2>
  assert(
    _ as D,
    _ as {
      x: number
      y: number
      z: number
      a: number
      b: number
    }
  )
  assert(
    _ as Flatten<CD>,
    _ as {
      x?: number | null | undefined
      y?: number | null | undefined
      z?: number | null | undefined
      a?: number | null | undefined
      b: number
    }
  )

  const p2 = new P2({ x: 20, b: 70 })

  assert(p2.a, _ as number)
  assert(p2.b, _ as number)
  assert(p2.x, _ as number)
  assert(p2.y, _ as number)
  assert(p2.z, _ as number)

  expect(p2.a).toBe(50)
  expect(p2.b).toBe(70)
  expect(p2.x).toBe(20)
  expect(p2.y).toBe(10)
  expect(p2.z).toBe(30)

  expect(p2.pMethod()).toBe("p")
  expect(p2.p2Method()).toBe("p2")
  expect(p2.sharedMethod()).toBe("p12")

  const p2sn = getSnapshot(p2)
  expect(p2sn).toMatchInlineSnapshot(`
    {
      "$modelType": "three level subclassing/P2_threeLevels",
      "a": 50,
      "b": 70,
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot(P2, p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)

  // actions must still work
  p2.setX(1000)
  expect(p2.x).toBe(1000)
  p2.setB(2000)
  expect(p2.b).toBe(2000)

  // type checking must still work
  expect(() => {
    p2.setX("10" as any)
  }).toThrow(
    'TypeCheckError: [/x] Expected a value of type <number> but got the value <"10"> instead'
  )

  expect(() => {
    p2.setB("10" as any)
  }).toThrow(
    'TypeCheckError: [/b] Expected a value of type <number> but got the value <"10"> instead'
  )
})

test("abstract-ish model classes with factory", () => {
  function createA<P>() {
    class A extends Model({
      value: prop<P>(),
    }) {
      public validate?(_value: P): string | undefined

      @computed
      public get error(): string | undefined {
        return this.validate!(this.value)
      }
    }

    return A
  }

  const StringA = createA<string>()

  @testModel("B-abstractish-factory")
  class B extends ExtendedModel(StringA, {}) {
    public validate(value: string): string | undefined {
      return value.length < 3 ? "too short" : undefined
    }
  }

  const b = new B({ value: "hi" })

  expect(b.value).toBe("hi")
  assert(b.value, _ as string)

  expect(b.validate("ho")).toBe("too short")
  expect(b.validate("long")).toBe(undefined)
  assert(b.validate, _ as (value: string) => string | undefined)

  expect(b.error).toBe("too short")
  assert(b.error, _ as string | undefined)

  expect(b instanceof StringA).toBe(true)
  assert(b, _ as B)
})

test("abstract-ish model classes without factory", () => {
  class A<P> extends Model({
    anotherValue: prop<number>(10),
  }) {
    public value!: P

    public validate?(_value: P): string | undefined

    @computed
    public get error(): string | undefined {
      return this.validate!(this.value)
    }
  }

  abstract class StringA extends A<string> {}

  @testModel("B-abstractish")
  class B extends ExtendedModel(StringA, {
    value: prop<string>(),
  }) {
    public validate(value: string): string | undefined {
      return value.length < 3 ? "too short" : undefined
    }
  }

  const b = new B({ value: "hi", anotherValue: 4 })

  expect(b.value).toBe("hi")
  assert(b.value, _ as string)

  expect(b.anotherValue).toBe(4)
  assert(b.anotherValue, _ as number)

  expect(b.validate("ho")).toBe("too short")

  expect(b.validate("long")).toBe(undefined)
  assert(b.validate, _ as (value: string) => string | undefined)

  expect(b.error).toBe("too short")
  assert(b.error, _ as string | undefined)

  expect(b instanceof StringA).toBe(true)
  assert(b, _ as B)
})

test("abstract model classes with factory", () => {
  function createA<P>() {
    abstract class A extends Model({
      anotherValue: prop<number>(10),
      value: prop<P>(),
    }) {
      public abstract validate(_value: P): string | undefined

      @computed
      public get error(): string | undefined {
        return this.validate!(this.value)
      }
    }

    return A
  }

  const StringA = createA<string>()

  @testModel("B-abstract-factory")
  class B extends ExtendedModel(StringA, {}) {
    public validate(value: string): string | undefined {
      return value.length < 3 ? "too short" : undefined
    }
  }

  const b = new B({ value: "hi", anotherValue: 4 })

  expect(b.value).toBe("hi")
  assert(b.value, _ as string)

  expect(b.anotherValue).toBe(4)
  assert(b.anotherValue, _ as number)

  expect(b.validate("ho")).toBe("too short")
  expect(b.validate("long")).toBe(undefined)
  assert(b.validate, _ as (value: string) => string | undefined)

  expect(b.error).toBe("too short")
  assert(b.error, _ as string | undefined)

  expect(b instanceof StringA).toBe(true)
  assert(b, _ as B)
})

test("abstract model classes without factory", () => {
  abstract class A<P> extends Model({
    anotherValue: prop<number>(10),
  }) {
    public abstract value: P

    public abstract validate(_value: P): string | undefined

    @computed
    public get error(): string | undefined {
      return this.validate(this.value)
    }
  }

  abstract class StringA extends A<string> {}

  @testModel("B-abstract")
  class B extends ExtendedModel(StringA, {
    value: prop<string>(),
  }) {
    public validate(value: string): string | undefined {
      return value.length < 3 ? "too short" : undefined
    }
  }

  const b = new B({ value: "hi", anotherValue: 4 })

  expect(b.value).toBe("hi")
  assert(b.value, _ as string)

  expect(b.anotherValue).toBe(4)
  assert(b.anotherValue, _ as number)

  expect(b.validate("ho")).toBe("too short")

  expect(b.validate("long")).toBe(undefined)
  assert(b.validate, _ as (value: string) => string | undefined)

  expect(b.error).toBe("too short")
  assert(b.error, _ as string | undefined)

  expect(b instanceof StringA).toBe(true)
  assert(b, _ as B)
})

test("issue #18", () => {
  abstract class A extends Model({}) {
    public /* abstract */ value: number = void 0 as any // similiar to what babel does when using an abstract prop without default value
  }

  @testModel("B#18")
  class B extends ExtendedModel(A, { value: prop<number>() }) {}

  // Error: data changes must be performed inside model actions
  const b = new B({ value: 1 }) // Instantiating the class inside `runUnprotected` works.
  expect(b.value).toBe(1)
})

test("issue #2", () => {
  abstract class Base<T> extends Model({}) {
    public abstract value: T
  }

  function ExtendedBase<T>(defaultValue: T) {
    abstract class ExtendedBaseT extends Base<T> {
      public abstract value: T
    }

    return ExtendedModel(ExtendedBaseT, {
      value: prop<T>(() => defaultValue),
    })
  }

  @testModel("issue-2/model")
  class MyModel extends ExtendedBase("val") {}

  const m = new MyModel({})

  assert(m.value, _ as string)
})

test("classes using model decorator can be extended", () => {
  @testModel("Point2d")
  class P2d extends Model({
    x: tProp(types.number, 15),
    y: tProp(types.number, 10),
  }) {
    get sum() {
      return this.x + this.y
    }
  }

  @testModel("Point3d")
  class P3d extends ExtendedModel(P2d, {
    z: tProp(types.number, 20),
  }) {
    get sum() {
      return super.sum + this.z
    }
  }

  {
    const p2d = new P2d({})
    expect(p2d.x).toBe(15)
    expect(p2d.y).toBe(10)
    expect((p2d as any).z).toBe(undefined)
    expect(p2d.$modelType).toBe("classes using model decorator can be extended/Point2d")
  }

  {
    const p3d = new P3d({})
    expect(p3d.x).toBe(15)
    expect(p3d.y).toBe(10)
    expect(p3d.z).toBe(20)
    expect(p3d.sum).toBe(p3d.x + p3d.y + p3d.z)
    expect(p3d.$modelType).toBe("classes using model decorator can be extended/Point3d")
  }
})

export function createClassWithType<T>(modelName: string) {
  const ClassWithTypeProps = Model({
    val: prop<T>(),
  })

  @testModel(`ClassWithType/${modelName}`)
  class ClassWithType extends ClassWithTypeProps {
    @modelAction
    test(_e: T) {}
  }

  return ClassWithType as ModelClassDeclaration<
    typeof ClassWithTypeProps,
    {
      test(e: T): void
    }
  >
}

test("external class factory with type declaration", () => {
  const ES = createClassWithType<number>("number")
  const es = new ES({ val: 5 })
  es.test(10)
})

test("issue #109", () => {
  @testModel("my/BaseModel")
  class BaseModel<T> extends Model({
    items: prop<string[]>(() => []),
  }) {
    superFoo(_x: T) {}
  }

  @testModel("my/ChildModel")
  class ChildModel extends ExtendedModel(modelClass<BaseModel<number>>(BaseModel), {}) {
    foo() {
      assert(this.items, _ as string[])
      this.items.push("hi")
      assert(this.superFoo, _ as (x: number) => void)
      this.superFoo(5)
    }
  }

  new ChildModel({})
})

test("ExtendedModel should bring static / prototype properties", () => {
  @testModel("Bobbin")
  class Bobbin extends Model({}) {
    static LAST = "Threadbare"
  }
  Object.defineProperty(Bobbin.prototype, "first", {
    value: "Bobbin",
    writable: false,
  })
  // (Bobbin.prototype as any).first = "Bobbin"

  expect((Bobbin.prototype as any).first).toBe("Bobbin")
  expect(Bobbin.LAST).toBe("Threadbare")

  const bobbin = new Bobbin({})
  expect((bobbin as any).first).toBe("Bobbin")
  expect((bobbin as any).LAST).toBe(undefined)

  @testModel("ExtendedBobbin")
  class ExtendedBobbin extends ExtendedModel(Bobbin, {}) {
    static LAST2 = "Threepwood"
  }
  Object.defineProperty(ExtendedBobbin.prototype, "first2", {
    value: "Guybrush",
    writable: false,
  })
  // (ExtendedBobbin.prototype as any).first2 = "Guybrush"

  expect((ExtendedBobbin.prototype as any).first).toBe("Bobbin")
  expect((ExtendedBobbin as any).LAST).toBe("Threadbare")
  expect((ExtendedBobbin.prototype as any).first2).toBe("Guybrush")
  expect((ExtendedBobbin as any).LAST2).toBe("Threepwood")

  const extendedBobbin = new ExtendedBobbin({})
  expect((extendedBobbin as any).first).toBe("Bobbin")
  expect((extendedBobbin as any).LAST).toBe(undefined)
  expect((extendedBobbin as any).first2).toBe("Guybrush")
  expect((extendedBobbin as any).LAST2).toBe(undefined)
})

test("new pattern for generics", () => {
  @testModel("GenericModel")
  class GenericModel<T1, T2> extends Model(<U1, U2>() => ({
    v1: prop<U1 | undefined>(),
    v2: prop<U2>(),
    v3: prop<number>(0),
  }))<T1, T2> {}

  assert(
    _ as ModelData<GenericModel<string, number>>,
    _ as { v1: string | undefined; v2: number; v3: number }
  )
  assert(
    _ as ModelData<GenericModel<number, string>>,
    _ as { v1: number | undefined; v2: string; v3: number }
  )

  const s = new GenericModel({ v1: "1", v2: 2, v3: 3 })
  assert(s, _ as GenericModel<string, number>)
  expect(s.v1).toBe("1")
  expect(s.v2).toBe(2)
  expect(s.v3).toBe(3)

  @testModel("ExtendedGenericModel")
  class ExtendedGenericModel<T1, T2> extends ExtendedModel(<T1, T2>() => ({
    baseModel: modelClass<GenericModel<T1, T2>>(GenericModel),
    props: {
      v4: prop<T2 | undefined>(),
    },
  }))<T1, T2> {}

  const e = new ExtendedGenericModel({ v1: "1", v2: 2, v3: 3, v4: 4 })
  assert(e, _ as ExtendedGenericModel<string, number>)
  expect(e.v1).toBe("1")
  expect(e.v2).toBe(2)
  expect(e.v3).toBe(3)
  expect(e.v4).toBe(4)
})

test("issue #310", () => {
  abstract class MyBaseModelWithId extends Model({
    id: idProp,
    name: prop<string>().withSetter(),
  }) {}

  @testModel("issue #310/MyExtendedModelWithoutId")
  class MyExtendedModelWithoutId extends ExtendedModel(MyBaseModelWithId, {
    extendedProp: prop<boolean>(),
  }) {}

  new MyExtendedModelWithoutId({
    id: "some id",
    name: "name",
    extendedProp: true,
  })
})

test("issue #358", () => {
  type DataType = number | string

  @testModel("issue #358/Value")
  class Value<T extends DataType> extends Model(<T extends DataType>() => ({
    data: prop<T>(),
  }))<T> {}

  @testModel("issue #358/Container")
  class Container<V extends Value<T>, T extends DataType> extends Model(<
    V extends Value<T>,
    T extends DataType,
  >() => ({
    value: prop<V>(),
  }))<V, T> {}

  const c = new Container<Value<number>, number>({
    value: new Value<number>({
      data: 1,
    }),
  })

  assert(c.value, _ as Value<number>)
  assert(c.value.data, _ as number)
})

test("issue #358/2", () => {
  type DataType = number | string

  @testModel("issue #358/2/Value")
  class Value<T extends DataType> extends Model(<T extends DataType>() => ({
    data: prop<T>().withSetter(),
  }))<T> {}

  @testModel("issue #358/2/Container")
  class Container<V extends Value<any>> extends Model(<V extends Value<DataType>>() => ({
    value: prop<V>(),
  }))<V> {}

  const c = new Container<Value<number>>({
    value: new Value<number>({
      data: 1,
    }),
  })

  assert(c.value, _ as Value<number>)
  assert(c.value.data, _ as number)
})

test("generic model instance factory", () => {
  @testModel("generic model instance factory/Parent")
  class Parent<T> extends Model(<T>() => ({
    a: prop<T>(),
    x: prop<number | undefined>(),
  }))<T> {}

  @testModel("generic model instance factory/Child")
  class Child<T> extends ExtendedModel(<T>() => ({
    baseModel: modelClass<Parent<T>>(Parent),
    props: {
      b: prop<T>(),
    },
  }))<T> {}

  function createParent<T>(a: T) {
    const parent = new Parent({ a })
    assert(_ as typeof parent, _ as Parent<T>)
  }

  function createChild<T>(a: T, b: T) {
    const child = new Child({ a, b })
    assert(_ as typeof child, _ as Child<T>)
  }

  createParent(10)
  createChild(10, 20)
})

test("statics get inherited", () => {
  @testModel("statics get inherited/A")
  class StaticA extends Model({}) {
    static foo = "foo" as const
  }

  ;(StaticA.prototype as any).foo = "foo"
  expect((StaticA.prototype as any).foo).toBe("foo")

  @testModel("statics get inherited/B")
  class StaticB extends ExtendedModel(StaticA, {}) {
    static bar = "bar" as const
  }

  expect((StaticB.prototype as any).foo).toBe("foo")
  ;(StaticB.prototype as any).foo = "bar"
  expect((StaticA.prototype as any).foo).toBe("foo")
  expect((StaticB.prototype as any).foo).toBe("bar")

  assert(StaticA.foo, _ as "foo")
  assert(StaticB.foo, _ as "foo")
  assert(StaticB.bar, _ as "bar")

  expect(StaticA.foo).toBe("foo")
  expect(StaticB.foo).toBe("foo")
  expect(StaticB.bar).toBe("bar")
})

test("modelAction, modelFlow and subclassing", async () => {
  abstract class BM extends Model({
    id: idProp,
    stateBm: prop<string>(),
  }) {
    @modelAction
    action11 = () => {
      this.stateBm = "action11"
    }

    @modelAction
    action12() {
      this.stateBm = "action12"
    }

    @modelFlow
    fetch1 = _async(function* (this: BM) {
      this.stateBm = "actionf1"
      yield* _await(Promise.resolve())
    })
  }

  @testModel("modelAction, modelFlow and subclassing/ModelA")
  class A extends ExtendedModel(BM, {
    stateSub: prop<string>(),
  }) {}

  @testModel("modelAction, modelFlow and subclassing/ModelB")
  class B extends ExtendedModel(BM, {
    stateSub: prop<string>(),
  }) {
    @modelAction
    action21 = () => {
      this.stateSub = "action21"
    }

    @modelAction
    action22() {
      this.stateSub = "action22"
    }

    @modelFlow
    fetch2 = _async(function* (this: B) {
      this.stateSub = "fetch2"
      yield* _await(Promise.resolve())
    })
  }

  const a = new A({
    stateSub: "bar",
    stateBm: "test",
  })

  expect(a.stateSub).toBe("bar")
  expect(a.stateBm).toBe("test")

  expect(a.fetch1).toBeDefined()
  await a.fetch1()
  expect(a.action11).toBeDefined()
  a.action11()
  expect(a.action12).toBeDefined()
  a.action12()

  expect((a as any).action21).toBeUndefined()
  expect((a as any).action22).toBeUndefined()
  expect((a as any).fetch2).toBeUndefined()

  const b = new B({
    stateSub: "bar2",
    stateBm: "test2",
  })

  expect(b.stateSub).toBe("bar2")
  expect(b.stateBm).toBe("test2")

  expect(b.action11).toBeDefined()
  b.action11()
  expect(b.action12).toBeDefined()
  b.action12()
  expect(b.fetch1).toBeDefined()
  await b.fetch1()

  expect(b.action21).toBeDefined()
  b.action21()
  expect(b.action22).toBeDefined()
  b.action22()
  expect(b.fetch2).toBeDefined()
  await b.fetch2()
})

test("it is possible to override defaults", () => {
  @testModel("Point2d")
  class P2d extends Model({
    x: tProp(types.number, 15),
    y: tProp(types.number, 10).withSetter(),
  }) {}

  @testModel("Point3d")
  class P3d extends ExtendedModel(P2d, {
    y: tProp(types.number, 40),
    z: tProp(types.number, 20),
  }) {}

  {
    const p2d = new P2d({})
    expect(p2d.x).toBe(15)
    assert(p2d.y, _ as number)
    expect(p2d.y).toBe(10)
    expect(p2d.setY).toBeDefined()
    expect((p2d as any).z).toBe(undefined)

    const p2dt = new P2d({ y: 50 })
    expect(p2dt.y).toBe(50)
  }

  {
    const p3d = new P3d({})
    expect(p3d.x).toBe(15)
    assert(p3d.y, _ as number)
    expect(p3d.y).toBe(40)
    expect(p3d.setY).toBeDefined()
    expect(p3d.z).toBe(20)

    const p3dt = new P3d({ y: 50 })
    expect(p3dt.y).toBe(50)
  }
})
