import { assert, _ } from "spec.ts"
import { idProp, Model, modelIdKey, prop, runUnprotected } from "../../src"
import { testModel } from "../utils"

@testModel("M")
class M extends Model({
  [modelIdKey]: idProp,
  $modelType: prop<number>(),
  onInit: prop(() => 10),
  x: prop(() => 20),
  y: prop(() => 20),
}) {
  // would throw, since it tries to change this.$.x and this.$ is intied on new M
  // x = 100

  // fails because already defined as prop of different type
  // x = "100"

  // fails because already defined as prop
  // y() {
  // }

  // ok since it is a base method
  onInit() {
    this.x += 100
  }
}

test("props with same name", () => {
  const m = new M({ $modelType: 5, $modelId: "10" })

  expect(m.x).toBe(120)
  expect(m.$.x).toBe(120)
  runUnprotected(() => {
    m.x += 20
  })
  expect(m.x).toBe(140)
  expect(m.$.x).toBe(140)

  assert(m.$modelType, _ as string)
  expect(typeof m.$modelType).toBe("string")
  assert(m.$.$modelType, _ as number)
  expect(m.$.$modelType).toBe(5)

  assert(m.onInit, _ as () => void)
  expect(typeof m.onInit).toBe("function")
  assert(m.$.onInit, _ as number)
  expect(m.$.onInit).toBe(10)
})
