import { computed } from "mobx"
import { assert, _ } from "spec.ts"
import {
  abstractModelClass,
  ExtendedModel,
  fromSnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  ModelCreationData,
  ModelData,
  prop,
  tProp,
  types,
} from "../../src"
import { ModelPropsToData } from "../../src/model/prop"
import "../commonSetup"

// @model("P")
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
  @model("P2_props")
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
  assert(_ as D, _ as { x: number; y: number; z: number } & { a: number; b: number })
  assert(
    _ as CD,
    _ as { x?: number | null; y?: number | null; z?: number | null } & {
      a?: number | null
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
    Object {
      "$modelId": "id-1",
      "$modelType": "P2_props",
      "a": 50,
      "b": 70,
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot<P2>(p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})

test("subclassing without additional props", () => {
  @model("P2_noprops")
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
  assert(_ as D, _ as { x: number; y: number; z: number } & ModelPropsToData<{}>)
  assert(
    _ as CD,
    _ as { x?: number | null; y?: number | null; z?: number | null } & ModelPropsToData<{}>
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
    Object {
      "$modelId": "id-2",
      "$modelType": "P2_noprops",
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot<P2>(p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})

test("subclassing without anything new", () => {
  @model("P2_nothingNew")
  class P2 extends ExtendedModel(P, {}) {}

  type D = ModelData<P2>
  type CD = ModelCreationData<P2>
  assert(_ as D, _ as { x: number; y: number; z: number } & ModelPropsToData<{}>)
  assert(
    _ as CD,
    _ as { x?: number | null; y?: number | null; z?: number | null } & ModelPropsToData<{}>
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
    Object {
      "$modelId": "id-3",
      "$modelType": "P2_nothingNew",
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot<P2>(p2sn)
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

  @model("P2_threeLevels")
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
  assert(_ as D, _ as { x: number; y: number; z: number } & { a: number } & { b: number })
  assert(
    _ as CD,
    _ as { x?: number | null; y?: number | null; z?: number | null } & { a?: number | null } & {
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
    Object {
      "$modelId": "id-4",
      "$modelType": "P2_threeLevels",
      "a": 50,
      "b": 70,
      "x": 20,
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot<P2>(p2sn)
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
  }).toThrow("TypeCheckError: [/x] Expected: number")

  expect(() => {
    p2.setB("10" as any)
  }).toThrow("TypeCheckError: [/b] Expected: number")
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

  @model("B-abstractish-factory")
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

  @model("B-abstractish")
  class B extends ExtendedModel(abstractModelClass(StringA), {
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

  @model("B-abstract-factory")
  class B extends ExtendedModel(abstractModelClass(StringA), {}) {
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

  @model("B-abstract")
  class B extends ExtendedModel(abstractModelClass(StringA), {
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
    public abstract value: number = void 0 as any // similiar to what babel does when using an abstract prop without default value
  }

  @model("B#18")
  class B extends ExtendedModel(abstractModelClass(A), { value: prop<number>() }) {}

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

    // sadly we are forced to use the cast to keep the generic of the type
    return class extends ExtendedModel(abstractModelClass(ExtendedBaseT), {
      value: prop<T>(() => defaultValue),
    }) {}
  }

  @model("issue-2/model")
  class MyModel extends ExtendedBase("val") {}

  const m = new MyModel({})

  assert(m.value, _ as string)
})

test("classes using model decorator can be extended", () => {
  @model("Point2d")
  class P2d extends Model({
    x: tProp(types.number, 15),
    y: tProp(types.number, 10),
  }) {
    get sum() {
      return this.x + this.y
    }
  }

  @model("Point3d")
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
    expect(p2d.$modelType).toBe("Point2d")
  }

  {
    const p3d = new P3d({})
    expect(p3d.x).toBe(15)
    expect(p3d.y).toBe(10)
    expect(p3d.z).toBe(20)
    expect(p3d.sum).toBe(p3d.x + p3d.y + p3d.z)
    expect(p3d.$modelType).toBe("Point3d")
  }
})
