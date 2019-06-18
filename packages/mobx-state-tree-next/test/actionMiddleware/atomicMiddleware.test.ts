import {
  addActionMiddleware,
  atomic,
  atomicMiddleware,
  findParent,
  model,
  Model,
  modelAction,
  modelFlow,
} from "../../src"
import "../commonSetup"

@model("P2")
class P2 extends Model {
  constructor() {
    super()

    addActionMiddleware(
      atomicMiddleware({
        model: this,
        actionName: "addParentX",
      })
    )
  }

  data = {
    y: 0,
  }

  @modelAction
  addY(n: number, error: boolean): number {
    this.data.y += n
    if (error) {
      throw new Error("addY - Error")
    }
    return this.data.y
  }

  @modelAction
  addParentX(n: number, error: boolean): number {
    return findParent<P>(this, p => p instanceof P)!.addX(n, error)
  }
}

@model("P")
class P extends Model {
  data = {
    x: 0,
    p2: new P2(),
  }

  @atomic
  @modelAction
  addX = (n: number, error: boolean): number => {
    this.data.x += n
    if (error) {
      throw new Error("addX - Error")
    }
    return this.data.x
  }

  @atomic
  @modelAction
  addY(a: number, b: number, error: boolean): number {
    this.data.p2.data.y += a
    this.data.p2.addY(b, error)
    return this.data.p2.data.y
  }
}

describe("atomicMiddleware - sync", () => {
  let p: P
  beforeEach(() => {
    p = new P()
  })

  test("simple root action", () => {
    expect(p.addX(10, false)).toBe(10)

    expect(() => p.addX(20, true)).toThrow("addX")
    expect(p.data.x).toBe(10)

    expect(p.addX(20, false)).toBe(10 + 20)
  })

  test("root action with subaction", () => {
    expect(p.addY(3, 7, false)).toBe(10)

    expect(() => p.addY(20, 30, true)).toThrow("addY")
    expect(p.data.p2.data.y).toBe(10)

    expect(p.addY(12, 8, false)).toBe(10 + 12 + 8)
  })

  test("non atomic action should still be non atomic", () => {
    expect(p.data.p2.addY(10, false)).toBe(10)

    expect(() => p.data.p2.addY(20, true)).toThrow("addY")
    expect(p.data.p2.data.y).toBe(10 + 20)
  })

  // TODO: maybe this should be revisited and changes should actually be reverted
  // but if the root changes it is hard to know where to apply the patches
  test("it cannot revert changes made to a parent", () => {
    expect(p.data.p2.addParentX(10, false)).toBe(10)

    expect(() => p.data.p2.addParentX(20, true)).toThrow("addX")
    expect(p.data.x).toBe(10 + 20)
  })
})

async function delay(x: number) {
  return new Promise<number>(r => setTimeout(() => r(x), x))
}

@model("P2Flow")
class P2Flow extends Model {
  constructor() {
    super()

    addActionMiddleware(
      atomicMiddleware({
        model: this,
        actionName: "addParentX",
      })
    )
  }

  data = {
    y: 0,
    z: 0,
  };

  @modelFlow
  *addY(n: number, error: boolean) {
    yield delay(5)
    this.data.y += n
    if (error) {
      throw new Error("addY - Error")
    }
    return this.data.y
  }

  @modelFlow
  *addParentX(n: number, error: boolean) {
    const parent = findParent<P>(this, p => p instanceof PFlow)!
    yield delay(5)
    return parent.addX(n, error)
  }

  @modelAction
  addZ(n: number) {
    this.data.z += n
    return this.data.z
  }
}

@model("PFlow")
class PFlow extends Model {
  data = {
    x: 0,
    p2: new P2Flow(),
  }

  @atomic
  @modelFlow
  addX = function*(this: PFlow, n: number, error: boolean) {
    this.data.x += n
    yield delay(5)
    if (error) {
      throw new Error("addX - Error")
    }
    return this.data.x
  };

  @atomic
  @modelFlow
  *addY(a: number, b: number, error: boolean) {
    this.data.p2.data.y += a
    yield delay(5)
    yield this.data.p2.addY(b, error)
    return this.data.p2.data.y
  }
}

describe("atomicMiddleware - async", () => {
  let p: PFlow
  beforeEach(() => {
    p = new PFlow()
  })

  test("simple root action", async () => {
    expect(await p.addX(10, false)).toBe(10)

    try {
      await p.addX(20, true)
      fail("should have thrown")
    } catch (e) {
      expect(e.message).toBe("addX - Error")
    }
    expect(p.data.x).toBe(10)

    expect(await p.addX(20, false)).toBe(10 + 20)
  })

  test("root action with subaction", async () => {
    expect(await p.addY(3, 7, false)).toBe(10)

    try {
      const promise = p.addY(20, 30, true)

      // do a change in the middle
      p.data.p2.addZ(100)
      expect(p.data.p2.data.z).toBe(100)

      await promise
      fail("should have thrown")
    } catch (e) {
      expect(e.message).toBe("addY - Error")
    }
    expect(p.data.p2.data.y).toBe(10)
    expect(p.data.p2.data.z).toBe(100) // this other change should not be reverted

    expect(await p.addY(12, 8, false)).toBe(10 + 12 + 8)
  })

  test("non atomic action should still be non atomic", async () => {
    expect(await p.data.p2.addY(10, false)).toBe(10)

    try {
      await p.data.p2.addY(20, true)
      fail("should have thrown")
    } catch (e) {
      expect(e.message).toBe("addY - Error")
    }
    expect(p.data.p2.data.y).toBe(10 + 20)
  })

  // TODO: maybe this should be revisited and changes should actually be reverted
  // but if the root changes it is hard to know where to apply the patches
  test("it cannot revert changes made to a parent", async () => {
    expect(await p.data.p2.addParentX(10, false)).toBe(10)

    try {
      await p.data.p2.addParentX(20, true)
      fail("should have thrown")
    } catch (e) {
      expect(e.message).toBe("addX - Error")
    }

    expect(p.data.x).toBe(10 + 20)
  })
})
