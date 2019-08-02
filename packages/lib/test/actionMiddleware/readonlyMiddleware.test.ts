import { model, Model, modelAction, modelFlow, newModel, readonlyMiddleware } from "../../src"
import "../commonSetup"
import { autoDispose, delay } from "../utils"

@model("P2")
export class P2 extends Model<{ y: number }> {
  defaultData = {
    y: 10,
  }

  @modelAction
  setY(y: number) {
    this.data.y = y
  }
}

@model("P")
export class P extends Model<{ x: number; p2: P2 }> {
  defaultData = {
    x: 5,
    p2: newModel(P2, {}),
  }

  @modelAction
  setXY(x: number, y: number) {
    this.data.x = x
    this.data.p2.setY(y)
    return x + y
  }

  @modelFlow
  *setXYAsync(x: number, y: number) {
    yield delay(50)
    this.data.x = x
    this.data.p2.setY(y)
    return x + y
  }
}

let p: P
beforeEach(() => {
  p = newModel(P, {})
})

test("subnode", () => {
  const { dispose, allowWrite } = readonlyMiddleware(p.data.p2)
  autoDispose(dispose)

  const oldY1 = p.data.p2.data.y
  expect(() => p.data.p2.setY(300)).toThrow("tried to invoke action 'setY' over a readonly node")
  expect(p.data.p2.data.y).toBe(oldY1)

  allowWrite(() => p.data.p2.setY(300))
  expect(p.data.p2.data.y).toBe(300)

  p.setXY(50, 400)
  expect(p.data.x).toBe(50)
  expect(p.data.p2.data.y).toBe(400)

  dispose()

  p.data.p2.setY(200)
  expect(p.data.p2.data.y).toBe(200)
})

test("root node", () => {
  const { dispose, allowWrite } = readonlyMiddleware(p)
  autoDispose(dispose)

  const oldY1 = p.data.p2.data.y
  expect(() => p.data.p2.setY(300)).toThrow("tried to invoke action 'setY' over a readonly node")
  expect(p.data.p2.data.y).toBe(oldY1)

  allowWrite(() => p.data.p2.setY(300))
  expect(p.data.p2.data.y).toBe(300)

  const oldX2 = p.data.x
  const oldY2 = p.data.p2.data.y
  expect(() => p.setXY(5, 10)).toThrow("tried to invoke action 'setXY' over a readonly node")
  expect(p.data.x).toBe(oldX2)
  expect(p.data.p2.data.y).toBe(oldY2)

  expect(allowWrite(() => p.setXY(500, 600))).toBe(500 + 600)
  expect(p.data.x).toBe(500)
  expect(p.data.p2.data.y).toBe(600)

  dispose()

  p.setXY(1000, 2000)
  expect(p.data.x).toBe(1000)
  expect(p.data.p2.data.y).toBe(2000)
})

test("root node (async)", async () => {
  const { dispose, allowWrite } = readonlyMiddleware(p)
  autoDispose(dispose)

  const oldX1 = p.data.x
  const oldY1 = p.data.p2.data.y
  try {
    await p.setXYAsync(5, 10)
    fail("should have failed")
  } catch (e) {
    expect(e.message).toBe("tried to invoke action 'setXYAsync' over a readonly node")
  }
  await delay(100) // just to make sure it didn't mutate later
  expect(p.data.x).toBe(oldX1)
  expect(p.data.p2.data.y).toBe(oldY1)

  const ret = await allowWrite(() => p.setXYAsync(5, 10))
  expect(ret).toBe(5 + 10)

  await delay(100) // just to make sure it didn't mutate later
  expect(p.data.x).toBe(5)
  expect(p.data.p2.data.y).toBe(10)
})
