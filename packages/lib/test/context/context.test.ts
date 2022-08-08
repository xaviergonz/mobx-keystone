import { observable, reaction, runInAction } from "mobx"
import { assert, _ } from "spec.ts"
import { createContext, fromSnapshot, getSnapshot, Model, prop, runUnprotected } from "../../src"
import { createP } from "../testbed"
import { autoDispose, testModel } from "../utils"

test("context with set default value", () => {
  const ctx = createContext(1)
  expect(ctx.getDefault()).toBe(1)
  ctx.setDefault(2)
  expect(ctx.getDefault()).toBe(2)
})

test("context with non set default value", () => {
  const ctx = createContext<number>()

  let reactionCalls = 0
  autoDispose(
    reaction(
      () => ctx.getDefault(),
      () => {
        reactionCalls++
      }
    )
  )

  expect(ctx.getDefault()).toBe(undefined)

  ctx.setDefault(2)
  expect(reactionCalls).toBe(1)
  expect(ctx.getDefault()).toBe(2)

  ctx.setDefault(undefined)
  expect(reactionCalls).toBe(2)
  expect(ctx.getDefault()).toBe(undefined)

  // using computed default
  const obs = observable.box(5)
  ctx.setDefaultComputed(() => obs.get())
  expect(reactionCalls).toBe(3)
  expect(ctx.getDefault()).toBe(5)

  runInAction(() => {
    obs.set(6)
  })
  expect(reactionCalls).toBe(4)
  expect(ctx.getDefault()).toBe(6)

  // back to static
  ctx.setDefault(20)
  expect(reactionCalls).toBe(5)
  expect(ctx.getDefault()).toBe(20)
})

test("context with static values", () => {
  const ctx = createContext(1)

  const p = createP()

  let pCalls = 0,
    p2Calls = 0,
    arrCalls = 0
  autoDispose(
    reaction(
      () => ctx.get(p),
      () => {
        pCalls++
      }
    )
  )
  autoDispose(
    reaction(
      () => ctx.get(p.p2!),
      () => {
        p2Calls++
      }
    )
  )
  autoDispose(
    reaction(
      () => ctx.get(p.arr),
      () => {
        arrCalls++
      }
    )
  )

  const expectReactionCalls = (p: number, p2: number, arr: number) => {
    expect(pCalls).toBe(p)
    expect(p2Calls).toBe(p2)
    expect(arrCalls).toBe(arr)
    pCalls = 0
    p2Calls = 0
    arrCalls = 0
  }

  // should use the default for now
  expectReactionCalls(0, 0, 0)
  expect(ctx.get(p)).toBe(1)
  expect(ctx.get(p.p2!)).toBe(1)
  expect(ctx.get(p.arr)).toBe(1)
  expect(ctx.getProviderNode(p)).toBe(undefined)
  expect(ctx.getProviderNode(p.p2!)).toBe(undefined)
  expect(ctx.getProviderNode(p.arr)).toBe(undefined)

  ctx.set(p, 2)
  expectReactionCalls(1, 1, 1)
  expect(ctx.get(p)).toBe(2)
  expect(ctx.get(p.p2!)).toBe(2)
  expect(ctx.get(p.arr)).toBe(2)
  expect(ctx.getProviderNode(p)).toBe(p)
  expect(ctx.getProviderNode(p.p2!)).toBe(p)
  expect(ctx.getProviderNode(p.arr)).toBe(p)

  // set same value again
  ctx.set(p, 2)
  expectReactionCalls(0, 0, 0)
  expect(ctx.get(p)).toBe(2)
  expect(ctx.get(p.p2!)).toBe(2)
  expect(ctx.get(p.arr)).toBe(2)
  expect(ctx.getProviderNode(p)).toBe(p)
  expect(ctx.getProviderNode(p.p2!)).toBe(p)
  expect(ctx.getProviderNode(p.arr)).toBe(p)

  ctx.set(p.p2!, 3)
  expectReactionCalls(0, 1, 0)
  expect(ctx.get(p)).toBe(2)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(2)
  expect(ctx.getProviderNode(p)).toBe(p)
  expect(ctx.getProviderNode(p.p2!)).toBe(p.p2)
  expect(ctx.getProviderNode(p.arr)).toBe(p)

  ctx.unset(p)
  expectReactionCalls(1, 0, 1)
  expect(ctx.get(p)).toBe(1)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(1)
  expect(ctx.getProviderNode(p)).toBe(undefined)
  expect(ctx.getProviderNode(p.p2!)).toBe(p.p2)
  expect(ctx.getProviderNode(p.arr)).toBe(undefined)

  ctx.setDefault(5)
  expectReactionCalls(1, 0, 1)
  expect(ctx.get(p)).toBe(5)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(5)
  expect(ctx.getProviderNode(p)).toBe(undefined)
  expect(ctx.getProviderNode(p.p2!)).toBe(p.p2)
  expect(ctx.getProviderNode(p.arr)).toBe(undefined)
})

test("context with computed values", () => {
  const ctx = createContext(1)

  const p = createP()

  let pCalls = 0,
    p2Calls = 0,
    arrCalls = 0
  autoDispose(
    reaction(
      () => ctx.get(p),
      () => {
        pCalls++
      }
    )
  )
  autoDispose(
    reaction(
      () => ctx.get(p.p2!),
      () => {
        p2Calls++
      }
    )
  )
  autoDispose(
    reaction(
      () => ctx.get(p.arr),
      () => {
        arrCalls++
      }
    )
  )

  const expectReactionCalls = (p: number, p2: number, arr: number) => {
    expect(pCalls).toBe(p)
    expect(p2Calls).toBe(p2)
    expect(arrCalls).toBe(arr)
    pCalls = 0
    p2Calls = 0
    arrCalls = 0
  }

  // should use the default for now
  expect(ctx.get(p)).toBe(1)
  expectReactionCalls(0, 0, 0)
  expect(ctx.get(p.p2!)).toBe(1)
  expect(ctx.get(p.arr)).toBe(1)

  ctx.setComputed(p, () => p.x) // p.x defaults to 5
  expectReactionCalls(1, 1, 1)
  expect(ctx.get(p)).toBe(p.x)
  expect(ctx.get(p.p2!)).toBe(p.x)
  expect(ctx.get(p.arr)).toBe(p.x)

  runUnprotected(() => {
    p.x = 10
  })
  expectReactionCalls(1, 1, 1)
  expect(ctx.get(p)).toBe(p.x)
  expect(ctx.get(p.p2!)).toBe(p.x)
  expect(ctx.get(p.arr)).toBe(p.x)

  ctx.set(p.p2!, 3)
  expectReactionCalls(0, 1, 0)
  expect(ctx.get(p)).toBe(p.x)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(p.x)

  // switch to static value
  ctx.set(p, 20)
  expectReactionCalls(1, 0, 1)
  expect(ctx.get(p)).toBe(20)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(20)

  // back to computed
  ctx.setComputed(p, () => p.x)
  expectReactionCalls(1, 0, 1)
  expect(ctx.get(p)).toBe(p.x)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(p.x)

  ctx.unset(p)
  expectReactionCalls(1, 0, 1)
  expect(ctx.get(p)).toBe(1)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(1)

  ctx.setDefault(5)
  expectReactionCalls(1, 0, 1)
  expect(ctx.get(p)).toBe(5)
  expect(ctx.get(p.p2!)).toBe(3)
  expect(ctx.get(p.arr)).toBe(5)
})

test("context typings", () => {
  const ctx1 = createContext<number>()
  assert(_ as ReturnType<typeof ctx1.getDefault>, _ as number | undefined)
  assert(_ as ReturnType<typeof ctx1.get>, _ as number | undefined)
  assert(_ as typeof ctx1.setDefault, _ as (v: number | undefined) => void)
  assert(_ as typeof ctx1.set, _ as (n: object, v: number | undefined) => void)
  assert(_ as typeof ctx1.setComputed, _ as (n: object, v: () => number | undefined) => void)

  const ctx2 = createContext(5)
  assert(_ as ReturnType<typeof ctx2.getDefault>, _ as number)
  assert(_ as ReturnType<typeof ctx2.get>, _ as number)
  assert(_ as typeof ctx2.setDefault, _ as (v: number) => void)
  assert(_ as typeof ctx2.set, _ as (n: object, v: number) => void)
  assert(_ as typeof ctx2.setComputed, _ as (n: object, v: () => number) => void)

  const ctx3 = createContext<number>(5)
  assert(_ as ReturnType<typeof ctx3.getDefault>, _ as number)
  assert(_ as ReturnType<typeof ctx3.get>, _ as number)
  assert(_ as typeof ctx3.setDefault, _ as (v: number) => void)
  assert(_ as typeof ctx3.set, _ as (n: object, v: number) => void)
  assert(_ as typeof ctx3.setComputed, _ as (n: object, v: () => number) => void)
})

test("context apply", () => {
  const ctx = createContext(1)

  let val = 2

  @testModel("M")
  class M extends Model({
    children: prop<M[]>(() => []),
  }) {
    onInit() {
      expect(ctx.getDefault()).toBe(1)
      expect(ctx.get(this)).toBe(val)
    }

    method() {
      expect(ctx.getDefault()).toBe(1)
      return ctx.get(this)
    }
  }

  const m = ctx.apply(() => new M({ children: [new M({})] }), val)
  expect(m.method()).toBe(val)
  expect(m.children[0].method()).toBe(val)

  const sn = getSnapshot(m)

  val = 3
  const m2 = ctx.apply(() => fromSnapshot(M, sn), val)
  expect(m2.method()).toBe(val)
  expect(m2.children[0].method()).toBe(val)
})

test("context applyComputed", () => {
  const ctx = createContext<number>()
  ctx.setDefaultComputed(() => 1)

  let val = 2

  @testModel("M")
  class M extends Model({
    children: prop<M[]>(() => []),
  }) {
    onInit() {
      expect(ctx.getDefault()).toBe(1)
      expect(ctx.get(this)).toBe(val)
    }

    method() {
      expect(ctx.getDefault()).toBe(1)
      return ctx.get(this)
    }
  }

  const m = ctx.applyComputed(
    () => new M({ children: [new M({})] }),
    () => val
  )
  expect(m.method()).toBe(val)
  expect(m.children[0].method()).toBe(val)

  const sn = getSnapshot(m)

  val = 3
  const m2 = ctx.applyComputed(
    () => fromSnapshot(M, sn),
    () => val
  )
  expect(m2.method()).toBe(val)
  expect(m2.children[0].method()).toBe(val)
})
