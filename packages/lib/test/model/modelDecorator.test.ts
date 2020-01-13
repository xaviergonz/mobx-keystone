import { getSnapshot, model, Model, modelTypeKey, prop } from "../../src"
import "../commonSetup"

test("model decorator preserves static properties", () => {
  @model("BarSimple")
  class Bar extends Model({}) {
    static foo = "foo"
  }

  expect(Bar.foo).toBe("foo")
})

test("model decorator preserves static property getters", () => {
  @model("BarWithGetter")
  class Bar extends Model({}) {
    static sideEffectCount = 0
    static get foo() {
      return Bar.sideEffectCount++
    }
  }

  expect(Bar.foo).toBe(0)
  expect(Bar.foo).toBe(1)
})

test("model decorator works with static proxy gymnastics", () => {
  class Bar extends Model({}) {}

  // @ts-ignore
  Bar = new Proxy(Bar, {
    get: (target, key: keyof typeof Bar | "foo") => {
      if (key === "foo") return "oof"
      return target[key]
    },
  })

  // @ts-ignore
  Bar = model("BarWithProxyStuff")(Bar)

  // @ts-ignore
  expect(Bar.foo).toBe("oof")
})

test("model decorator sets model type static prop and toString methods", () => {
  class MyModel extends Model({
    name: prop(() => "hello"),
  }) {
    x: number = 1 // not-stored-properties not rendered
  }

  expect(MyModel[modelTypeKey]).toBeUndefined()

  const type = "com/myModel"
  const MyModel2 = model(type)(MyModel)

  expect(MyModel[modelTypeKey]).toBe(type)
  expect(MyModel2[modelTypeKey]).toBe(type)

  expect(`${MyModel}`).toBe(`class MyModel#${type}`)
  expect(`${MyModel2}`).toBe(`class MyModel#${type}`)

  const inst = new MyModel2({}) as MyModel
  expect(`${inst}`).toBe(`[MyModel#${type} ${JSON.stringify(getSnapshot(inst))}]`)
  expect(`${inst.toString({ withData: false })}`).toBe(`[MyModel#${type}]`)
})
