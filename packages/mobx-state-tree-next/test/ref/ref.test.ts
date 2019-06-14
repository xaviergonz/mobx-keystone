import {
  fromSnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelMetadataKey,
  Ref,
  ref,
  registerRootStore,
} from "../../src"
import "../commonSetup"

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
  setR(r: P2 | undefined, autoDetach = false) {
    this.data.r = r ? ref(r, { autoDetach }) : undefined
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

  expect(p.data.r!.isValid).toBe(true)
  expect(p.data.r!.current).toBe(p2)
  expect(p.data.r!.maybeCurrent).toBe(p2)

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-3",
        "type": "$$Ref",
      },
      "id": "mockedUuid-2",
    }
  `)

  // not under the same root now
  p.setP2(undefined)
  expect(p.data.r!.isValid).toBe(false)
  expect(p.data.r!.maybeCurrent).toBe(undefined)
  expect(() => p.data.r!.current).toThrow(
    "a model with id 'mockedUuid-2' could not be found in the same tree as the reference"
  )

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-3",
        "type": "$$Ref",
      },
      "id": "mockedUuid-2",
    }
  `)

  // change the path, the ref should still be ok
  p.setP3(p2)
  expect(p.data.r!.isValid).toBe(true)
  expect(p.data.r!.maybeCurrent).toBe(p2)
  expect(p.data.r!.current).toBe(p2)

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-3",
        "type": "$$Ref",
      },
      "id": "mockedUuid-2",
    }
  `)

  // not under the same root now
  const r = p.data.r!
  p.setR(undefined)
  expect(p.data.r).toBeUndefined()
  expect(r.isValid).toBe(false)
  expect(r.maybeCurrent).toBe(undefined)
  expect(() => r.current).toThrow(
    "a model with id 'mockedUuid-2' could not be found in the same tree as the reference"
  )

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`undefined`)
})

test("ref loaded from a snapshot", () => {
  // we use two snapshots to ensure duplicated ids work when they are on different trees

  const p = fromSnapshot<P>({
    [modelMetadataKey]: {
      type: "P",
      id: "P-1",
    },
    p2: {
      [modelMetadataKey]: {
        type: "P2",
        id: "P2-1",
      },
    },
    r: {
      [modelMetadataKey]: {
        type: "$$Ref",
        id: "Ref-1",
      },
      id: "P2-1",
    },
  })

  const pp = fromSnapshot<P>({
    [modelMetadataKey]: {
      type: "P",
      id: "P-1",
    },
    p2: {
      [modelMetadataKey]: {
        type: "P2",
        id: "P2-1",
      },
    },
    r: {
      [modelMetadataKey]: {
        type: "$$Ref",
        id: "Ref-1",
      },
      id: "P2-1",
    },
  })

  const r = p.data.r!
  expect(r).toBeDefined()
  expect(r.isValid).toBe(true)
  expect(r.maybeCurrent).toBe(p.data.p2)
  expect(r.current).toBe(p.data.p2)

  const rr = pp.data.r!
  expect(rr).toBeDefined()
  expect(rr.isValid).toBe(true)
  expect(rr.maybeCurrent).toBe(pp.data.p2)
  expect(rr.current).toBe(pp.data.p2)
})

test("ref loaded from a broken snapshot", () => {
  const p = fromSnapshot<P>({
    [modelMetadataKey]: {
      type: "P",
      id: "P-1",
    },
    p2: {
      [modelMetadataKey]: {
        type: "P2",
        id: "P2-1",
      },
    },
    r: {
      [modelMetadataKey]: {
        type: "$$Ref",
        id: "Ref-1",
      },
      id: "P2-2",
    },
  })

  const r = p.data.r!
  expect(r).toBeDefined()
  expect(r.isValid).toBe(false)
  expect(r.maybeCurrent).toBe(undefined)
  expect(() => r.current).toThrow(
    "a model with id 'P2-2' could not be found in the same tree as the reference"
  )
})

test("autoDetach ref", () => {
  const p = new P()
  registerRootStore(p)

  const p2 = new P2()

  p.setP2(p2)
  p.setR(p2, true)
  expect(p.data.r).toBeDefined()

  expect(p.data.r!.isValid).toBe(true)
  expect(p.data.r!.maybeCurrent).toBe(p2)
  expect(p.data.r!.current).toBe(p2)

  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-6",
        "type": "$$Ref",
      },
      "autoDetach": true,
      "id": "mockedUuid-5",
    }
  `)

  // not under the same root now
  const r = p.data.r!
  p.setP2(undefined)
  expect(p.data.r).toBe(undefined)
  expect(getSnapshot(p.data.r)).toMatchInlineSnapshot(`undefined`)
  expect(r.isValid).toBe(false)
  expect(r.maybeCurrent).toBe(undefined)
  expect(() => r.current).toThrow(
    "a model with id 'mockedUuid-5' could not be found in the same tree as the reference"
  )
})
