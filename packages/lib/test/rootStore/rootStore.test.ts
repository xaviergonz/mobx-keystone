import { reaction } from "mobx"
import {
  getRootStore,
  isRootStore,
  model,
  Model,
  modelAction,
  prop,
  registerRootStore,
  runUnprotected,
  toTreeNode,
  unregisterRootStore,
} from "../../src"
import "../commonSetup"

const events: string[] = []

@model("P3")
export class P3 extends Model({
  z: prop(() => 20),
}) {
  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    events.push("p3Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      events.push("p3Detached")
    }
  }
}

@model("P2")
export class P2 extends Model({
  y: prop(() => 10),
  p3: prop(() => new P3({})),
}) {
  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    expect(getRootStore(this.p3)).toBe(rootStore)
    events.push("p2Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      expect(getRootStore(this.p3)).toBeUndefined()
      events.push("p2Detached")
    }
  }
}

@model("P")
export class P extends Model({
  x: prop(() => 5),
  arr: prop<P2[]>(() => []),
  p2: prop<P2 | undefined>(),
}) {
  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    if (this.p2) {
      expect(getRootStore(this.p2)).toBe(rootStore)
    }
    this.arr.forEach((p2) => {
      expect(getRootStore(p2)).toBe(rootStore)
    })
    events.push("p1Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      if (this.p2) {
        expect(getRootStore(this.p2)).toBeUndefined()
      }
      this.arr.forEach((p2) => {
        expect(getRootStore(p2)).toBeUndefined()
      })
      events.push("p1Detached")
    }
  }
}

export function createP() {
  return new P({
    p2: new P2({
      y: 12,
    }),
  })
}

function resetEvents() {
  events.length = 0
}

beforeEach(() => {
  resetEvents()
})

test("model as rootStore", () => {
  const p = createP()
  expect(getRootStore(p)).toBeUndefined()
  expect(isRootStore(p)).toBeFalsy()

  expect(events).toStrictEqual([])

  // register p as root store
  expect(registerRootStore(p)).toBe(p)

  expect(isRootStore(p)).toBeTruthy()
  expect(isRootStore(p.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(p.p2!)).toBe(p)
  expect(events).toMatchInlineSnapshot(`
    Array [
      "p1Attached",
      "p2Attached",
      "p3Attached",
    ]
  `)

  // detach p2 from root store
  resetEvents()
  const oldP2 = p.p2!
  runUnprotected(() => {
    p.p2 = undefined
  })

  expect(isRootStore(p)).toBeTruthy()
  expect(() => isRootStore(p.p2!)).toThrow("node must be a tree node")
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(oldP2)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
        Array [
          "p3Detached",
          "p2Detached",
        ]
    `)

  // reattach
  resetEvents()
  runUnprotected(() => {
    p.p2 = oldP2
  })

  expect(isRootStore(p)).toBeTruthy()
  expect(isRootStore(p.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(p.p2!)).toBe(p)
  expect(events).toMatchInlineSnapshot(`
    Array [
      "p2Attached",
      "p3Attached",
    ]
  `)

  // unregister root store
  resetEvents()
  unregisterRootStore(p)
  expect(isRootStore(p)).toBeFalsy()
  expect(isRootStore(p.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBeUndefined()
  expect(getRootStore(p.p2!)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    Array [
      "p3Detached",
      "p2Detached",
      "p1Detached",
    ]
  `)
})

test("array as rootStore", () => {
  const arr = toTreeNode<P3[]>([new P3({})])
  expect(getRootStore(arr)).toBeUndefined()
  expect(isRootStore(arr)).toBeFalsy()

  expect(events).toStrictEqual([])

  // register arr as root store
  expect(registerRootStore(arr)).toBe(arr)

  expect(isRootStore(arr)).toBeTruthy()
  expect(isRootStore(arr[0]!)).toBeFalsy()
  expect(getRootStore(arr)).toBe(arr)
  expect(getRootStore(arr[0]!)).toBe(arr)
  expect(events).toMatchInlineSnapshot(`
        Array [
          "p3Attached",
        ]
    `)

  // detach p3 from root store
  resetEvents()
  const oldP3 = arr[0]!
  runUnprotected(() => {
    arr.splice(0, 1)
  })

  expect(isRootStore(arr)).toBeTruthy()
  expect(arr.length).toBe(0)
  expect(getRootStore(arr)).toBe(arr)
  expect(getRootStore(oldP3)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
        Array [
          "p3Detached",
        ]
    `)

  // reattach
  resetEvents()
  runUnprotected(() => {
    arr.push(oldP3)
  })

  expect(isRootStore(arr)).toBeTruthy()
  expect(isRootStore(arr[0]!)).toBeFalsy()
  expect(getRootStore(arr)).toBe(arr)
  expect(getRootStore(arr[0]!)).toBe(arr)
  expect(events).toMatchInlineSnapshot(`
        Array [
          "p3Attached",
        ]
    `)

  // unregister root store
  resetEvents()
  unregisterRootStore(arr)
  expect(isRootStore(arr)).toBeFalsy()
  expect(isRootStore(arr[0]!)).toBeFalsy()
  expect(getRootStore(arr)).toBeUndefined()
  expect(getRootStore(arr[0]!)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    Array [
      "p3Detached",
    ]
  `)
})

test("issue #27", () => {
  @model("#27/ModelWithArrayProp")
  class ModelWithArrayProp extends Model({
    values: prop<number[]>(),
  }) {
    onAttachedToRootStore(): void {
      this.setValues([1, 2, 3])
    }

    @modelAction
    public setValues(values: number[]): void {
      this.values = values
    }
  }

  const m = registerRootStore(new ModelWithArrayProp({ values: [] }))
  expect(m.values).toEqual([1, 2, 3])
})

test("isRootStore is reactive", () => {
  @model("isRootStore is reactive/M")
  class M extends Model({}) {}
  const obj = new M({})
  const events: boolean[] = []

  reaction(
    () => isRootStore(obj),
    (isRS) => {
      events.push(isRS)
    },
    { fireImmediately: true }
  )

  expect(events).toEqual([false])
  events.length = 0

  registerRootStore(obj)
  expect(events).toEqual([true])
  events.length = 0

  unregisterRootStore(obj)
  expect(events).toEqual([false])
  events.length = 0
})
