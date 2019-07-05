import {
  getRootStore,
  isRootStore,
  model,
  Model,
  newModel,
  registerRootStore,
  runUnprotected,
  toTreeNode,
  unregisterRootStore,
} from "../../src"
import "../commonSetup"

const events: string[] = []

@model("P3")
export class P3 extends Model<{ z: number }> {
  defaultData = {
    z: 20,
  }

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
export class P2 extends Model<{ y: number; p3: P3 }> {
  defaultData = {
    y: 10,
    p3: newModel(P3, {}),
  }

  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    events.push("p2Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      events.push("p2Detached")
    }
  }
}

@model("P")
export class P extends Model<{ x: number; arr: P2[]; p2?: P2 }> {
  defaultData = {
    x: 5,
    arr: [],
    p2: undefined,
  }

  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    events.push("p1Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      events.push("p1Detached")
    }
  }
}

export function createP() {
  return newModel(P, {
    p2: newModel(P2, {
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
  expect(isRootStore(p.data.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(p.data.p2!)).toBe(p)
  expect(events).toMatchInlineSnapshot(`
        Array [
          "p1Attached",
          "p2Attached",
          "p3Attached",
        ]
    `)

  // detach p2 from root store
  resetEvents()
  const oldP2 = p.data.p2!
  runUnprotected(() => {
    p.data.p2 = undefined
  })

  expect(isRootStore(p)).toBeTruthy()
  expect(isRootStore(p.data.p2!)).toBeFalsy()
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
    p.data.p2 = oldP2
  })

  expect(isRootStore(p)).toBeTruthy()
  expect(isRootStore(p.data.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(p.data.p2!)).toBe(p)
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
  expect(isRootStore(p.data.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBeUndefined()
  expect(getRootStore(p.data.p2!)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    Array [
      "p3Detached",
      "p2Detached",
      "p1Detached",
    ]
  `)
})

test("array as rootStore", () => {
  const arr = toTreeNode<P3[]>([newModel(P3, {})])
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
