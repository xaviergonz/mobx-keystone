import { assert, _ } from "spec.ts"
import { Model, model, newModel, prop, runUnprotected } from "../../src"
import "../commonSetup"

@model("M")
class M extends Model({
  modelId: prop<number>(),
  onInit: prop(() => 10),
  x: prop(() => 20),
  y: prop(() => 20),
}) {
  // would throw, since it tries to change this.$.x and this.$ is intied on newModel
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
  const m = newModel(M, { modelId: 5 })

  expect(m.x).toBe(120)
  expect(m.$.x).toBe(120)
  runUnprotected(() => {
    m.x += 20
  })
  expect(m.x).toBe(140)
  expect(m.$.x).toBe(140)

  assert(m.modelId, _ as string)
  expect(typeof m.modelId).toBe("string")
  assert(m.$.modelId, _ as number)
  expect(m.$.modelId).toBe(5)

  assert(m.onInit, _ as () => void)
  expect(typeof m.onInit).toBe("function")
  assert(m.$.onInit, _ as number)
  expect(m.$.onInit).toBe(10)
})
