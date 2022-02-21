import {
  applyPatches,
  model,
  Model,
  modelAction,
  modelFlow,
  onPatches,
  prop,
  readonlyMiddleware,
  _async,
  _await,
} from "../../src"
import { autoDispose, delay } from "../utils"

@model("P2")
export class P2 extends Model({
  y: prop(() => 10),
}) {
  @modelAction
  setY(y: number) {
    this.y = y
  }
}

@model("P")
export class P extends Model({
  x: prop(() => 5),
  p2: prop(() => new P2({})),
}) {
  @modelAction
  setXY(x: number, y: number) {
    this.x = x
    this.p2.setY(y)
    return x + y
  }

  private *_setXYAsync(x: number, y: number) {
    yield* _await(delay(50))
    this.x = x
    this.p2.setY(y)
    return x + y
  }

  @modelFlow
  setXYAsync = _async(this._setXYAsync)
}

let p: P
beforeEach(() => {
  p = new P({})
})

test("subnode", () => {
  const { dispose, allowWrite } = readonlyMiddleware(p.p2)
  autoDispose(dispose)

  const oldY1 = p.p2.y
  expect(() => p.p2.setY(300)).toThrow("tried to invoke action 'setY' over a readonly node")
  expect(p.p2.y).toBe(oldY1)

  allowWrite(() => p.p2.setY(300))
  expect(p.p2.y).toBe(300)

  expect(() => p.setXY(50, 400)).toThrow("tried to invoke action 'setY' over a readonly node")
  expect(p.x).toBe(50)
  expect(p.p2.y).toBe(300) // unchanged

  allowWrite(() => {
    p.setXY(60, 500)
  })
  expect(p.x).toBe(60)
  expect(p.p2.y).toBe(500)

  dispose()

  p.p2.setY(200)
  expect(p.p2.y).toBe(200)
})

test("root node", () => {
  const { dispose, allowWrite } = readonlyMiddleware(p)
  autoDispose(dispose)

  const oldY1 = p.p2.y
  expect(() => p.p2.setY(300)).toThrow("tried to invoke action 'setY' over a readonly node")
  expect(p.p2.y).toBe(oldY1)

  allowWrite(() => p.p2.setY(300))
  expect(p.p2.y).toBe(300)

  const oldX2 = p.x
  const oldY2 = p.p2.y
  expect(() => p.setXY(5, 10)).toThrow("tried to invoke action 'setXY' over a readonly node")
  expect(p.x).toBe(oldX2)
  expect(p.p2.y).toBe(oldY2)

  expect(allowWrite(() => p.setXY(500, 600))).toBe(500 + 600)
  expect(p.x).toBe(500)
  expect(p.p2.y).toBe(600)

  dispose()

  p.setXY(1000, 2000)
  expect(p.x).toBe(1000)
  expect(p.p2.y).toBe(2000)
})

test("root node (async)", async () => {
  const { dispose, allowWrite } = readonlyMiddleware(p)
  autoDispose(dispose)

  const oldX1 = p.x
  const oldY1 = p.p2.y
  try {
    await p.setXYAsync(5, 10)
    fail("should have failed")
  } catch (e: any) {
    expect(e.message).toBe("tried to invoke action 'setXYAsync' over a readonly node")
  }
  await delay(100) // just to make sure it didn't mutate later
  expect(p.x).toBe(oldX1)
  expect(p.p2.y).toBe(oldY1)

  const ret = await allowWrite(() => p.setXYAsync(5, 10))
  expect(ret).toBe(5 + 10)

  await delay(100) // just to make sure it didn't mutate later
  expect(p.x).toBe(5)
  expect(p.p2.y).toBe(10)
})

test("applyPatches", () => {
  const { dispose, allowWrite } = readonlyMiddleware(p)
  autoDispose(dispose)

  expect(p.x).toBe(5)
  expect(() => {
    applyPatches(p, [
      {
        op: "replace",
        path: ["x"],
        value: 6,
      },
    ])
  }).toThrow("tried to invoke action '$$applyPatches' over a readonly node")
  expect(p.x).toBe(5)

  allowWrite(() => {
    applyPatches(p, [
      {
        op: "replace",
        path: ["x"],
        value: 6,
      },
    ])
  })
  expect(p.x).toBe(6)
})

test("action inside onPatches", () => {
  const { dispose, allowWrite } = readonlyMiddleware(p)
  autoDispose(dispose)

  const anotherP = new P({})
  let calls = 0
  autoDispose(
    onPatches(anotherP, () => {
      calls++

      allowWrite(() => {
        p.setXY(500, 600)
      })

      expect(() => {
        p.setXY(100, 200)
      }).toThrow("tried to invoke action 'setXY' over a readonly node")
    })
  )

  expect(p.x).toBe(5)
  anotherP.setXY(400, 500)
  expect(calls).toBe(2)
  expect(p.x).toBe(500)
})
