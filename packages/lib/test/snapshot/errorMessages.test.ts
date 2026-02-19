import {
  applyPatches,
  applySnapshot,
  fromSnapshot,
  Model,
  SnapshotProcessingError,
} from "../../src"
import { testModel } from "../utils"

@testModel("issue #487/ApplyErrorModel")
class ApplyErrorModel extends Model({}) {}

test("fromSnapshot structural errors include nested path", () => {
  expect(() =>
    fromSnapshot({
      a: {
        b: new Map(),
      },
    } as any)
  ).toThrow("a snapshot must not contain maps - Path: /a/b - Value: {}")

  expect(() =>
    fromSnapshot({
      a: [new Set()],
    } as any)
  ).toThrow("a snapshot must not contain sets - Path: /a/0 - Value: {}")

  expect(() =>
    fromSnapshot({
      a: new Date("2020-01-01T00:00:00.000Z"),
    } as any)
  ).toThrow('unsupported snapshot - Path: /a - Value: "2020-01-01T00:00:00.000Z"')

  try {
    fromSnapshot({
      a: {
        b: new Map(),
      },
    } as any)
    throw new Error("expected fromSnapshot to throw")
  } catch (err) {
    const e = err as any
    expect(e).toBeInstanceOf(SnapshotProcessingError)
    expect(e.path).toEqual(["a", "b"])
    expect(e.message).toBe("a snapshot must not contain maps - Path: /a/b - Value: {}")
  }
})

test("applySnapshot structural errors include nested path", () => {
  const m = new ApplyErrorModel({})

  expect(() =>
    applySnapshot(m, {
      foo: new Map(),
    } as any)
  ).toThrow(
    "a snapshot must not contain maps - Path: /foo - Value: {} - Model trail: issue #487/ApplyErrorModel"
  )

  try {
    applySnapshot(m, {
      foo: new Map(),
    } as any)
    throw new Error("expected applySnapshot to throw")
  } catch (err) {
    const e = err as any
    expect(e).toBeInstanceOf(SnapshotProcessingError)
    expect(e.path).toEqual(["foo"])
    expect(e.message).toBe(
      "a snapshot must not contain maps - Path: /foo - Value: {} - Model trail: issue #487/ApplyErrorModel"
    )
  }

  expect(() =>
    applySnapshot(m, {
      foo: [new Set()],
    } as any)
  ).toThrow(
    "a snapshot must not contain sets - Path: /foo/0 - Value: {} - Model trail: issue #487/ApplyErrorModel"
  )

  expect(() =>
    applySnapshot(m, {
      foo: new Date("2020-01-01T00:00:00.000Z"),
    } as any)
  ).toThrow(
    'unsupported snapshot - Path: /foo - Value: "2020-01-01T00:00:00.000Z" - Model trail: issue #487/ApplyErrorModel'
  )

  try {
    applySnapshot(m, new Map() as any)
    throw new Error("expected applySnapshot to throw")
  } catch (err) {
    const e = err as any
    expect(e).toBeInstanceOf(SnapshotProcessingError)
    expect(e.path).toEqual([])
    expect(e.message).toBe("a snapshot must not contain maps - Path: / - Value: {}")
  }
})

test("applyPatches structural errors include patch path", () => {
  const m = new ApplyErrorModel({})

  expect(() =>
    applyPatches(m, [
      {
        op: "add",
        path: ["foo"],
        value: new Date("2020-01-01T00:00:00.000Z"),
      },
    ] as any)
  ).toThrow('unsupported snapshot - Path: /foo - Value: "2020-01-01T00:00:00.000Z"')
})
