import { getSnapshot, idProp, Model, runUnprotected, tProp, types } from "../../src"
import { testModel } from "../utils"

test("mixed model arrays retain captured snapshot values", () => {
  @testModel("union-snapshot-child")
  class Child extends Model({ key: idProp, count: tProp(0) }) {}
  @testModel("union-snapshot-root")
  class Root extends Model({
    items: tProp(types.array(types.or(Child, types.number)), () => [new Child({ key: "a" }), 0]),
  }) {}
  const root = new Root({})
  const snapshots = [getSnapshot(root)]
  for (let count = 1; count <= 3; count++) {
    runUnprotected(() => {
      ;(root.items[0] as Child).count = count
    })
    snapshots.push(getSnapshot(root))
  }
  snapshots.forEach((snapshot, count) => {
    expect(snapshot.items[0]).toMatchObject({ count })
  })
})

test("custom processor wrappers preserve shared child snapshots", () => {
  @testModel("wrapped-snapshot-child")
  class Child extends Model({ count: tProp(0) }) {}
  @testModel("wrapped-snapshot-root")
  class Root extends Model(
    { items: tProp(types.array(Child), () => [new Child({})]) },
    { toSnapshotProcessor: (snapshot) => ({ items: snapshot.items.slice() }) }
  ) {}
  const root = new Root({})
  const first = getSnapshot(root)
  runUnprotected(() => {
    root.items[0].count = 1
  })
  const second = getSnapshot(root)
  runUnprotected(() => {
    root.items[0].count = 2
  })
  expect(first).toMatchObject({ items: [{ count: 0 }] })
  expect(second).toMatchObject({ items: [{ count: 1 }] })
  expect(getSnapshot(root)).toMatchObject({ items: [{ count: 2 }] })
})

test("identity processors preserve snapshots captured after earlier edits", () => {
  @testModel("identity-snapshot-root")
  class Root extends Model({ count: tProp(0) }, { toSnapshotProcessor: (snapshot) => snapshot }) {}
  const root = new Root({})
  runUnprotected(() => {
    root.count = 1
  })
  const snapshot = getSnapshot(root)
  runUnprotected(() => {
    root.count = 2
  })
  expect(snapshot.count).toBe(1)
  expect(getSnapshot(root).count).toBe(2)
})
