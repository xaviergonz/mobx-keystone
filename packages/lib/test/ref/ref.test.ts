import {
  fromSnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelSnapshotInWithMetadata,
  newModel,
  prop,
  Ref,
  ref,
  registerRootStore,
} from "../../src"
import "../commonSetup"

@model("P2")
class P2 extends Model({
  y: prop(() => 10),
}) {}

@model("P")
class P extends Model({
  p2: prop<P2 | undefined>(),
  p3: prop<P2 | undefined>(),
  r: prop<Ref<P2> | undefined>(),
}) {
  @modelAction
  setR(r: P2 | undefined, autoDetach = false) {
    this.r = r ? ref(r, { autoDetach }) : undefined
  }

  @modelAction
  setP2(p2: P2 | undefined) {
    this.p2 = p2
  }

  @modelAction
  setP3(p2: P2 | undefined) {
    this.p3 = p2
  }
}

test("ref", () => {
  const p = newModel(P, {})
  const p2 = newModel(P2, {})

  p.setP2(p2)
  p.setR(p2)
  expect(p.r).toBeDefined()

  expect(p.r!.isValid).toBe(true)
  expect(p.r!.current).toBe(p2)
  expect(p.r!.maybeCurrent).toBe(p2)

  expect(getSnapshot(p.r)).toMatchInlineSnapshot(`
            Object {
              "$$metadata": Object {
                "id": "mockedUuid-3",
                "type": "$$Ref",
              },
              "autoDetach": false,
              "id": "mockedUuid-2",
            }
      `)

  // not under the same root now
  p.setP2(undefined)
  expect(p.r!.isValid).toBe(false)
  expect(p.r!.maybeCurrent).toBe(undefined)
  expect(() => p.r!.current).toThrow(
    "a model with id 'mockedUuid-2' could not be found in the same tree as the reference"
  )

  expect(getSnapshot(p.r)).toMatchInlineSnapshot(`
            Object {
              "$$metadata": Object {
                "id": "mockedUuid-3",
                "type": "$$Ref",
              },
              "autoDetach": false,
              "id": "mockedUuid-2",
            }
      `)

  // change the path, the ref should still be ok
  p.setP3(p2)
  expect(p.r!.isValid).toBe(true)
  expect(p.r!.maybeCurrent).toBe(p2)
  expect(p.r!.current).toBe(p2)

  expect(getSnapshot(p.r)).toMatchInlineSnapshot(`
            Object {
              "$$metadata": Object {
                "id": "mockedUuid-3",
                "type": "$$Ref",
              },
              "autoDetach": false,
              "id": "mockedUuid-2",
            }
      `)

  // not under the same root now
  const r = p.r!
  p.setR(undefined)
  expect(p.r).toBeUndefined()
  expect(r.isValid).toBe(false)
  expect(r.maybeCurrent).toBe(undefined)
  expect(() => r.current).toThrow(
    "a model with id 'mockedUuid-2' could not be found in the same tree as the reference"
  )

  expect(getSnapshot(p.r)).toMatchInlineSnapshot(`undefined`)
})

test("ref loaded from a snapshot", () => {
  // we use two snapshots to ensure duplicated ids work when they are on different trees

  const p = fromSnapshot<P>(
    modelSnapshotInWithMetadata(
      P,
      {
        p2: modelSnapshotInWithMetadata(P2, {}, "P2-1"),
        r: modelSnapshotInWithMetadata(
          Ref,
          {
            id: "P2-1",
          },
          "Ref-1"
        ),
      },
      "P-1"
    )
  )

  const pp = fromSnapshot<P>(
    modelSnapshotInWithMetadata(
      P,
      {
        p2: modelSnapshotInWithMetadata(P2, {}, "P2-1"),
        r: modelSnapshotInWithMetadata(
          Ref,
          {
            id: "P2-1",
          },
          "Ref-1"
        ),
      },
      "P-1"
    )
  )

  const r = p.r!
  expect(r).toBeDefined()
  expect(r.isValid).toBe(true)
  expect(r.maybeCurrent).toBe(p.p2)
  expect(r.current).toBe(p.p2)

  const rr = pp.r!
  expect(rr).toBeDefined()
  expect(rr.isValid).toBe(true)
  expect(rr.maybeCurrent).toBe(pp.p2)
  expect(rr.current).toBe(pp.p2)
})

test("ref loaded from a broken snapshot", () => {
  const p = fromSnapshot<P>(
    modelSnapshotInWithMetadata(
      P,
      {
        p2: modelSnapshotInWithMetadata(P2, {}, "P2-1"),
        r: modelSnapshotInWithMetadata(
          Ref,
          {
            id: "P2-2",
          },
          "Ref-1"
        ),
      },
      "P-1"
    )
  )

  const r = p.r!
  expect(r).toBeDefined()
  expect(r.isValid).toBe(false)
  expect(r.maybeCurrent).toBe(undefined)
  expect(() => r.current).toThrow(
    "a model with id 'P2-2' could not be found in the same tree as the reference"
  )
})

test("autoDetach ref", () => {
  const p = newModel(P, {})
  registerRootStore(p)

  const p2 = newModel(P2, {})

  p.setP2(p2)
  p.setR(p2, true)
  expect(p.r).toBeDefined()

  expect(p.r!.isValid).toBe(true)
  expect(p.r!.maybeCurrent).toBe(p2)
  expect(p.r!.current).toBe(p2)

  expect(getSnapshot(p.r)).toMatchInlineSnapshot(`
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
  const r = p.r!
  p.setP2(undefined)
  expect(p.r).toBe(undefined)
  expect(getSnapshot(p.r)).toMatchInlineSnapshot(`undefined`)
  expect(r.isValid).toBe(false)
  expect(r.maybeCurrent).toBe(undefined)
  expect(() => r.current).toThrow(
    "a model with id 'mockedUuid-5' could not be found in the same tree as the reference"
  )
})
