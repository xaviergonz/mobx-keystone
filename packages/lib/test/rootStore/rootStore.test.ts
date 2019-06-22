import {
  getRootStore,
  getRootStoreEnv,
  isRootStore,
  model,
  Model,
  newModel,
  registerRootStore,
  runUnprotected,
  unregisterRootStore,
} from "../../src"
import "../commonSetup"

const events: string[] = []

@model("P3")
export class P3 extends Model<{ z: number }> {
  defaultData = {
    z: 20,
  }

  onAttachedToRootStore(rootStore: any) {
    expect(isRootStore(rootStore)).toBeTruthy()
    expect(getRootStoreEnv(this)).toBeTruthy()
    events.push("p3Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      expect(getRootStoreEnv(this)).toBeUndefined()
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

  onAttachedToRootStore(rootStore: any) {
    expect(isRootStore(rootStore)).toBeTruthy()
    expect(getRootStoreEnv(this)).toBeTruthy()
    events.push("p2Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      expect(getRootStoreEnv(this)).toBeUndefined()
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

  onAttachedToRootStore(rootStore: any) {
    expect(isRootStore(rootStore)).toBeTruthy()
    expect(getRootStoreEnv(this)).toBeTruthy()
    events.push("p1Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      expect(getRootStoreEnv(this)).toBeUndefined()
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

test("rootStore", () => {
  const envObj = { hi: "there" }

  const p = createP()
  expect(getRootStore(p)).toBeUndefined()
  expect(isRootStore(p)).toBeFalsy()
  expect(getRootStoreEnv(p)).toBeUndefined()

  expect(events).toStrictEqual([])

  // register p as root store
  expect(registerRootStore(p, { env: envObj })).toBe(p)

  expect(isRootStore(p)).toBeTruthy()
  expect(isRootStore(p.data.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(p.data.p2!)).toBe(p)
  expect(getRootStoreEnv(p)).toBe(envObj)
  expect(getRootStoreEnv(p.data.p2!)).toBe(envObj)
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
  expect(getRootStoreEnv(p)).toBe(envObj)
  expect(getRootStoreEnv(oldP2)).toBeUndefined()
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
  expect(getRootStoreEnv(p)).toBe(envObj)
  expect(getRootStoreEnv(p.data.p2!)).toBe(envObj)
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
  expect(getRootStoreEnv(p)).toBeUndefined()
  expect(getRootStoreEnv(p.data.p2!)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    Array [
      "p3Detached",
      "p2Detached",
      "p1Detached",
    ]
  `)
})
