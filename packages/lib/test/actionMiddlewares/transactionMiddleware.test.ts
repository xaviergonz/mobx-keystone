import {
  findParent,
  Model,
  modelAction,
  modelFlow,
  prop,
  transaction,
  transactionMiddleware,
  _async,
  _await,
} from "../../src"
import { testModel } from "../utils"

@testModel("P2")
class P2 extends Model({
  y: prop(() => 0),
}) {
  onInit() {
    transactionMiddleware({
      model: this,
      actionName: "addParentX",
    })
  }

  @modelAction
  addY(n: number, error: boolean): number {
    this.y += n
    if (error) {
      throw new Error("addY - Error")
    }
    return this.y
  }

  @modelAction
  addParentX(n: number, error: boolean): number {
    return findParent<P>(this, (p) => p instanceof P)!.addX(n, error)
  }
}

@testModel("P")
class P extends Model({
  x: prop(() => 0),
  p2: prop(() => new P2({})),
}) {
  @transaction
  @modelAction
  addX = (n: number, error: boolean): number => {
    this.x += n
    if (error) {
      throw new Error("addX - Error")
    }
    return this.x
  }

  @transaction
  @modelAction
  addY(a: number, b: number, error: boolean): number {
    this.p2.y += a
    this.p2.addY(b, error)
    return this.p2.y
  }
}

describe("transactionMiddleware - sync", () => {
  let p: P
  beforeEach(() => {
    p = new P({})
  })

  test("simple root action", () => {
    expect(p.addX(10, false)).toBe(10)

    expect(() => p.addX(20, true)).toThrow("addX")
    expect(p.x).toBe(10)

    expect(p.addX(20, false)).toBe(10 + 20)
  })

  test("root action with subaction", () => {
    expect(p.addY(3, 7, false)).toBe(10)

    expect(() => p.addY(20, 30, true)).toThrow("addY")
    expect(p.p2.y).toBe(10)

    expect(p.addY(12, 8, false)).toBe(10 + 12 + 8)
  })

  test("non transaction action should still be non transaction", () => {
    expect(p.p2.addY(10, false)).toBe(10)

    expect(() => p.p2.addY(20, true)).toThrow("addY")
    expect(p.p2.y).toBe(10 + 20)
  })

  test("it can revert changes made to a parent", () => {
    expect(p.p2.addParentX(10, false)).toBe(10)

    expect(() => p.p2.addParentX(20, true)).toThrow("addX")
    expect(p.x).toBe(10)
  })
})

async function delay(x: number) {
  return new Promise<number>((r) =>
    setTimeout(() => {
      r(x)
    }, x)
  )
}

@testModel("P2Flow")
class P2Flow extends Model({
  y: prop(() => 0),
  z: prop(() => 0),
}) {
  onInit() {
    transactionMiddleware({
      model: this,
      actionName: "addParentX",
    })
  }

  private *_addY(n: number, error: boolean) {
    yield* _await(delay(5))
    this.y += n
    if (error) {
      throw new Error("addY - Error")
    }
    return this.y
  }

  @modelFlow
  addY = _async(this._addY)

  private *_addParentX(n: number, error: boolean) {
    const parent = findParent<PFlow>(this, (p) => p instanceof PFlow)!
    yield* _await(delay(5))
    const ret = yield* _await(parent.addX(n, error))
    return ret
  }

  @modelFlow
  addParentX = _async(this._addParentX)

  @modelAction
  addZ(n: number) {
    this.z += n
    return this.z
  }
}

@testModel("PFlow")
class PFlow extends Model({
  x: prop(() => 0),
  p2: prop(() => new P2Flow({})),
}) {
  private *_addX(n: number, error: boolean) {
    this.x += n
    yield* _await(delay(5))
    if (error) {
      throw new Error("addX - Error")
    }
    return this.x
  }

  @transaction
  @modelFlow
  addX = _async(this._addX)

  private *_addY(a: number, b: number, error: boolean) {
    this.p2.y += a
    yield* _await(delay(5))
    yield* _await(this.p2.addY(b, error))
    return this.p2.y
  }

  @transaction
  @modelFlow
  addY = _async(this._addY)
}

describe("transactionMiddleware - async", () => {
  let p: PFlow
  beforeEach(() => {
    p = new PFlow({})
  })

  test("simple root action", async () => {
    expect(await p.addX(10, false)).toBe(10)

    try {
      await p.addX(20, true)
      fail("should have thrown")
    } catch (e: any) {
      expect(e.message).toBe("addX - Error")
    }
    expect(p.x).toBe(10)

    expect(await p.addX(20, false)).toBe(10 + 20)
  })

  test("root action with subaction", async () => {
    expect(await p.addY(3, 7, false)).toBe(10)

    try {
      const promise = p.addY(20, 30, true)

      // do a change in the middle
      p.p2.addZ(100)
      expect(p.p2.z).toBe(100)

      await promise
      fail("should have thrown")
    } catch (e: any) {
      expect(e.message).toBe("addY - Error")
    }
    expect(p.p2.y).toBe(10)
    expect(p.p2.z).toBe(100) // this other change should not be reverted

    expect(await p.addY(12, 8, false)).toBe(10 + 12 + 8)
  })

  test("non transaction action should still be non transaction", async () => {
    expect(await p.p2.addY(10, false)).toBe(10)

    try {
      await p.p2.addY(20, true)
      fail("should have thrown")
    } catch (e: any) {
      expect(e.message).toBe("addY - Error")
    }
    expect(p.p2.y).toBe(10 + 20)
  })

  test("it can revert changes made to a parent", async () => {
    expect(await p.p2.addParentX(10, false)).toBe(10)

    try {
      await p.p2.addParentX(20, true)
      fail("should have thrown")
    } catch (e: any) {
      expect(e.message).toBe("addX - Error")
    }

    expect(p.x).toBe(10)
  })
})
