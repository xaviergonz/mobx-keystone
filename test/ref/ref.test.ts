import {
  fromSnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelIdKey,
  Ref,
  ref,
  typeofKey,
} from "../../src"

@model("P2")
class P2 extends Model {
  data = {
    y: 10,
  }
}

@model("P")
class P extends Model {
  data: {
    p2?: P2
    p3?: P2
    r?: Ref<P2>
  } = {}

  @modelAction
  setR(r: P2 | undefined) {
    this.data.r = r ? ref(r) : undefined
  }

  @modelAction
  setP2(p2: P2 | undefined) {
    this.data.p2 = p2
  }

  @modelAction
  setP3(p2: P2 | undefined) {
    this.data.p3 = p2
  }
}

test("ref", () => {
  const p = new P()
  const p2 = new P2()

  p.setP2(p2)
  p.setR(p2)
  expect(p.data.r).toBeDefined()

  expect(p.data.r!.current).toBe(p2)
  expect(p.data.r!.isValid).toBe(true)

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`
    Object {
      "$$id": "mockedUuid-3",
      "$$typeof": "$$Ref",
      "id": "mockedUuid-2",
    }
  `)

  // not under the same root now
  p.setP2(undefined)
  expect(p.data.r!.current).toBe(p2)
  expect(p.data.r!.isValid).toBe(false)

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`
    Object {
      "$$id": "mockedUuid-3",
      "$$typeof": "$$Ref",
      "id": "mockedUuid-2",
    }
  `)

  // change the path, the ref should still be ok
  p.setP3(p2)
  expect(p.data.r!.current).toBe(p2)
  expect(p.data.r!.isValid).toBe(true)

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`
    Object {
      "$$id": "mockedUuid-3",
      "$$typeof": "$$Ref",
      "id": "mockedUuid-2",
    }
  `)

  // not under the same root now
  const r = p.data.r!
  p.setR(undefined)
  expect(p.data.r).toBeUndefined()
  expect(r.current).toBe(p2)
  expect(r.isValid).toBe(false)

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`undefined`)
})

test("ref loaded from a snapshot", () => {
  // we use two snapshots to ensure duplicated ids work when they are on different trees

  const p = fromSnapshot<P>({
    [typeofKey]: "P",
    [modelIdKey]: "P-1",
    p2: {
      [typeofKey]: "P2",
      [modelIdKey]: "P2-1",
    },
    r: {
      [typeofKey]: "$$Ref",
      [modelIdKey]: "Ref-1",
      id: "P2-1",
    },
  })

  const pp = fromSnapshot<P>({
    [typeofKey]: "P",
    [modelIdKey]: "P-1",
    p2: {
      [typeofKey]: "P2",
      [modelIdKey]: "P2-1",
    },
    r: {
      [typeofKey]: "$$Ref",
      [modelIdKey]: "Ref-1",
      id: "P2-1",
    },
  })

  const r = p.data.r!
  expect(r).toBeDefined()
  expect(r.isValid).toBe(true)
  expect(r.current).toBe(p.data.p2)

  const rr = pp.data.r!
  expect(rr).toBeDefined()
  expect(rr.isValid).toBe(true)
  expect(rr.current).toBe(pp.data.p2)
})

test("ref loaded from a broken snapshot", () => {
  const p = fromSnapshot<P>({
    [typeofKey]: "P",
    [modelIdKey]: "P-1",
    p2: {
      [typeofKey]: "P2",
      [modelIdKey]: "P2-1",
    },
    r: {
      [typeofKey]: "$$Ref",
      [modelIdKey]: "Ref-1",
      id: "P2-2",
    },
  })

  const r = p.data.r!
  expect(r).toBeDefined()
  expect(r.isValid).toBe(false)
  expect(() => r.current).toThrow(
    "a model with id 'P2-2' could not be found in the same tree as the reference"
  )
})
