import { model, Model } from "../../src"
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
