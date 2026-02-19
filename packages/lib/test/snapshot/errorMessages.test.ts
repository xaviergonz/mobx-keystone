import {
  applyPatches,
  applySnapshot,
  fromSnapshot,
  frozen,
  getSnapshot,
  idProp,
  Model,
  modelIdKey,
  modelTypeKey,
  prop,
  SnapshotProcessingError,
} from "../../src"
import { testModel } from "../utils"

@testModel("issue #487/ApplyErrorModel")
class ApplyErrorModel extends Model({}) {}

@testModel("issue #487/ApplyOtherModel")
class ApplyOtherModel extends Model({}) {}

@testModel("issue #487/ApplyIdModel")
class ApplyIdModel extends Model({
  [modelIdKey]: idProp,
  n: prop(1),
}) {}

@testModel("issue #487/ApplyArrayTargetModel")
class ApplyArrayTargetModel extends Model({
  arr: prop<number[]>(() => []),
}) {}

@testModel("issue #487/ApplyPlainObjectTargetModel")
class ApplyPlainObjectTargetModel extends Model({
  obj: prop<Record<string, unknown>>(() => ({})),
}) {}

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

test("applySnapshot model mismatch and target mismatch errors are path-aware", () => {
  const m = new ApplyErrorModel({})

  expect(() => applySnapshot(m, [] as any)).toThrow(
    "if the snapshot is an array the target must be an array too - Path: / - Value: []"
  )

  const frozenSnapshot = getSnapshot(frozen({ x: 1 }))
  expect(() => applySnapshot(m, frozenSnapshot as any)).toThrow(
    `applySnapshot cannot be used over frozen objects - Path: / - Value: ${JSON.stringify(
      frozenSnapshot
    )}`
  )

  const unknownModelSnapshot = {
    [modelTypeKey]: "issue #487/UnknownModel",
  }
  expect(() => applySnapshot(m, unknownModelSnapshot as any)).toThrow(
    `model with name "issue #487/UnknownModel" not found in the registry - Path: / - Value: ${JSON.stringify(
      unknownModelSnapshot
    )}`
  )

  const knownModelSnapshot = {
    [modelTypeKey]: "issue #487/ApplyErrorModel",
  }
  const plainTarget = new ApplyPlainObjectTargetModel({})
  expect(() => applySnapshot(plainTarget.obj as any, knownModelSnapshot as any)).toThrow(
    `the target for a model snapshot must be a model instance - Path: / - Value: ${JSON.stringify(
      knownModelSnapshot
    )}`
  )

  const other = new ApplyOtherModel({})
  expect(() => applySnapshot(other, knownModelSnapshot as any)).toThrow(
    `snapshot model type 'issue #487/ApplyErrorModel' does not match target model type 'issue #487/ApplyOtherModel' - Path: / - Value: ${JSON.stringify(
      knownModelSnapshot
    )}`
  )

  const withId = new ApplyIdModel({
    [modelIdKey]: "id-1",
    n: 1,
  })
  const idMismatchSnapshot = {
    [modelTypeKey]: "issue #487/ApplyIdModel",
    [modelIdKey]: "id-2",
    n: 1,
  }
  expect(() => applySnapshot(withId, idMismatchSnapshot as any)).toThrow(
    `snapshot model id 'id-2' does not match target model id 'id-1' - Path: / - Value: ${JSON.stringify(
      idMismatchSnapshot
    )}`
  )

  const arrTarget = new ApplyArrayTargetModel({})
  const objectSnapshot = { x: 1 }
  expect(() => applySnapshot(arrTarget.arr as any, objectSnapshot as any)).toThrow(
    `if the snapshot is an object the target must be an object too - Path: / - Value: ${JSON.stringify(
      objectSnapshot
    )}`
  )
})

test("fromSnapshot model-snapshot structural errors include path and value", () => {
  const missingTypeSnapshot = {
    [modelTypeKey]: "",
  }
  expect(() => fromSnapshot(missingTypeSnapshot as any)).toThrow(
    `a model snapshot must contain a type key (${modelTypeKey}), but none was found - Path: / - Value: ${JSON.stringify(
      missingTypeSnapshot
    )}`
  )

  const unknownTypeSnapshot = {
    [modelTypeKey]: "issue #487/UnknownModel",
  }
  expect(() => fromSnapshot(unknownTypeSnapshot as any)).toThrow(
    `model with name "issue #487/UnknownModel" not found in the registry - Path: / - Value: ${JSON.stringify(
      unknownTypeSnapshot
    )}`
  )

  const missingIdSnapshot = {
    [modelTypeKey]: "issue #487/ApplyIdModel",
    n: 5,
  }
  expect(() => fromSnapshot(missingIdSnapshot as any)).toThrow(
    `a model snapshot of type 'issue #487/ApplyIdModel' must contain an id key (${modelIdKey}), but none was found - Path: / - Value: ${JSON.stringify(
      missingIdSnapshot
    )}`
  )
})
