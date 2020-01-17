import { autorun, observable, reaction } from "mobx"
import {
  getSnapshot,
  model,
  Model,
  modelAction,
  prop,
  registerRootStore,
  runUnprotected,
} from "../../src"
import "../commonSetup"
import { createP } from "../testbed"
import { autoDispose } from "../utils"

test("basic types", () => {
  expect(getSnapshot(undefined)).toBe(undefined)
  expect(getSnapshot(null)).toBe(null)
  expect(getSnapshot(7)).toBe(7)
  expect(getSnapshot("str")).toBe("str")

  const obj = { a: 5 }
  expect(() => getSnapshot(observable(obj))).toThrow("must be a tree node") // not part of a tree

  const arr = [1, 2, 3]
  expect(() => getSnapshot(observable(arr))).toThrow("must be a tree node") // not part of a tree
})

test("model class", () => {
  const p = createP()
  runUnprotected(() => {
    p.x = 8
  })

  // initial state
  expect(getSnapshot(p)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-2",
      "$modelType": "P",
      "arr": Array [],
      "p2": Object {
        "$modelId": "id-1",
        "$modelType": "P2",
        "y": 12,
      },
      "x": 8,
    }
  `)

  // detach submodel
  const oldP2 = p.p2!
  runUnprotected(() => {
    p.p2 = undefined
  })

  expect(getSnapshot(p)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-2",
      "$modelType": "P",
      "arr": Array [],
      "p2": undefined,
      "x": 8,
    }
  `)

  expect(getSnapshot(oldP2)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-1",
      "$modelType": "P2",
      "y": 12,
    }
  `)

  // mutate and reattach submodel
  runUnprotected(() => {
    oldP2.y++
    p.p2 = oldP2
  })

  expect(getSnapshot(p)).toMatchInlineSnapshot(`
    Object {
      "$modelId": "id-2",
      "$modelType": "P",
      "arr": Array [],
      "p2": Object {
        "$modelId": "id-1",
        "$modelType": "P2",
        "y": 13,
      },
      "x": 8,
    }
  `)
})

test("when unobserved they should not be generated each time", () => {
  const p = createP()
  const sna = getSnapshot(p)
  const snb = getSnapshot(p)

  expect(sna).toBe(snb)

  expect(sna.p2).toBe(snb.p2)
  expect(sna.arr).toBe(snb.arr)
})

test("when observed they should be the same", () => {
  const p = createP()
  autorun(() => {
    const sna = getSnapshot(p)
    const snb = getSnapshot(p)
    expect(sna).toBe(snb)
    expect(sna.p2).toBe(snb.p2)
    expect(sna.arr).toBe(snb.arr)

    runUnprotected(() => {
      p.p2!.y++
    })

    const snc = getSnapshot(p)
    expect(snc).not.toBe(sna)
    expect(snc).not.toStrictEqual(sna)
    expect(sna.p2).not.toBe(snc.p2)
    expect(sna.arr).toBe(snc.arr) // unchanged should be the same
  })()
})

test("reactive snapshots", () => {
  const p = createP()

  const pResult: any[] = []
  autoDispose(
    reaction(
      () => getSnapshot(p),
      newSn => {
        pResult.push(newSn)
      }
    )
  )

  const p2Result: any[] = []
  autoDispose(
    reaction(
      () => getSnapshot(p.p2),
      newSn => {
        p2Result.push(newSn)
      }
    )
  )

  expect(pResult.length).toBe(0)
  expect(p2Result.length).toBe(0)

  runUnprotected(() => {
    p.x++
  })
  expect(pResult.length).toBe(1)
  expect(p2Result.length).toBe(0)

  runUnprotected(() => {
    p.x++
  })
  expect(pResult.length).toBe(2)
  expect(p2Result.length).toBe(0)

  // changing children should also change the parent snapshot
  runUnprotected(() => {
    p.p2!.y++
  })
  expect(pResult.length).toBe(3)
  expect(p2Result.length).toBe(1)

  // no op
  runUnprotected(() => {
    p.x = p.x // eslint-disable-line no-self-assign
    p.p2!.y = p.p2!.y
  })
  expect(pResult.length).toBe(3)
  expect(p2Result.length).toBe(1)
})

test("issue #74 - with action", () => {
  @model("#74-1/A")
  class A extends Model({
    value: prop<number>(),
  }) {
    public onAttachedToRootStore() {
      this.value = 1

      return () => {
        this.value = 2
      }
    }
  }

  @model("#74-1/Store")
  class Store extends Model({
    all: prop<A[]>(() => []),
  }) {
    @modelAction
    public add(a: A): void {
      this.all.push(a)
      expect(a.value).toBe(0) // since onAttachedToRootStore will be run after all actions are finished
    }

    @modelAction
    public remove(index: number): void {
      const removed = this.all.splice(index, 1)
      expect(removed[0].value).toBe(1) // since onAttachedToRootStore disposer will be run after all actions are finished
    }
  }

  const store = registerRootStore(new Store({}))
  const newA = new A({ value: 0 })
  store.add(newA)

  expect(getSnapshot(store).all).toHaveLength(store.all.length)
  expect(newA.value).toBe(1)
  expect(getSnapshot(newA).value).toBe(1)

  store.remove(0)
  expect(getSnapshot(store).all).toHaveLength(store.all.length)
  expect(newA.value).toBe(2)
  expect(getSnapshot(newA).value).toBe(2)
})

test("issue #74 - with runUnprotected", () => {
  @model("#74-2/A")
  class A extends Model({
    value: prop<number>(),
  }) {
    public onAttachedToRootStore() {
      this.value = 1

      return () => {
        this.value = 2
      }
    }
  }

  @model("#74-2/Store")
  class Store extends Model({
    all: prop<A[]>(() => []),
  }) {}

  const store = registerRootStore(new Store({}))
  const newA = new A({ value: 0 })

  runUnprotected(() => {
    store.all.push(newA)
    expect(newA.value).toBe(0) // since onAttachedToRootStore will be run after all actions are finished
  })

  expect(getSnapshot(store).all).toHaveLength(store.all.length)
  expect(newA.value).toBe(1)
  expect(getSnapshot(newA).value).toBe(1)

  runUnprotected(() => {
    const removed = store.all.splice(0, 1)
    expect(removed[0].value).toBe(1) // since onAttachedToRootStore disposer will be run after all actions are finished
  })

  expect(getSnapshot(store).all).toHaveLength(store.all.length)
  expect(newA.value).toBe(2)
  expect(getSnapshot(newA).value).toBe(2)
})
