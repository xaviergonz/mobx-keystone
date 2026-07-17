import { types } from "../../src"
import { resolveTypeChecker } from "../../src/types/resolveTypeChecker"
import {
  type SnapshotProcessor,
  snapshotProcessorPlan,
  TypeChecker,
  TypeCheckerBaseType,
} from "../../src/types/TypeChecker"

function createTestChecker(
  fromSnapshotProcessor:
    | SnapshotProcessor
    | ReturnType<typeof snapshotProcessorPlan>
    | undefined = undefined,
  toSnapshotProcessor:
    | SnapshotProcessor
    | ReturnType<typeof snapshotProcessorPlan>
    | undefined = undefined,
  checked = false
): TypeChecker {
  let checker!: TypeChecker
  checker = new TypeChecker(
    TypeCheckerBaseType.Any,
    checked ? () => null : null,
    () => "test",
    () => undefined as never,
    () => checker,
    fromSnapshotProcessor,
    toSnapshotProcessor
  )
  return checker
}

test("toSnapshotProcessor caches undefined object results", () => {
  let calls = 0
  let checker!: TypeChecker
  checker = new TypeChecker(
    TypeCheckerBaseType.Object,
    null,
    () => "test",
    () => undefined as never,
    () => checker,
    undefined,
    () => {
      calls++
      return undefined
    }
  )
  const snapshot = {}

  expect(checker.toSnapshotProcessor(snapshot)).toBeUndefined()
  expect(checker.toSnapshotProcessor(snapshot)).toBeUndefined()
  expect(calls).toBe(1)

  checker.invalidateSnapshotProcessorCachedResult(snapshot)
  expect(checker.toSnapshotProcessor(snapshot)).toBeUndefined()
  expect(calls).toBe(2)
})

test("identity-only recursive object processors resolve to cached undefined", () => {
  let schemaCalls = 0
  let recursiveType: any
  recursiveType = types.object(() => {
    schemaCalls++
    return {
      value: types.string,
      children: types.array(recursiveType),
    }
  })

  expect(schemaCalls).toBe(0)

  const checker = resolveTypeChecker(recursiveType)
  expect(schemaCalls).toBe(1)
  expect(checker.getFromSnapshotProcessor()).toBeUndefined()
  expect(checker.getFromSnapshotProcessor()).toBeUndefined()
  expect(checker.getToSnapshotProcessor()).toBeUndefined()
  expect(checker.getToSnapshotProcessor()).toBeUndefined()
  expect(schemaCalls).toBe(1)
})

test("identity-only mutually recursive object processors resolve to undefined", () => {
  let leftType: any
  let rightType: any
  leftType = types.object(() => ({ right: rightType }))
  rightType = types.object(() => ({ left: leftType }))

  const checker = resolveTypeChecker(leftType)
  expect(checker.getFromSnapshotProcessor()).toBeUndefined()
  expect(checker.getToSnapshotProcessor()).toBeUndefined()
})

test("recursive processor graphs process codecs beyond their back-edge", () => {
  let recursiveType: any
  recursiveType = types.object(() => ({
    value: types.bigint,
    children: types.array(recursiveType),
  }))

  const checker = resolveTypeChecker(recursiveType)
  const fromProcessor = checker.getFromSnapshotProcessor()
  const toProcessor = checker.getToSnapshotProcessor()

  expect(fromProcessor).toBeTypeOf("function")
  expect(toProcessor).toBeTypeOf("function")

  const stored = {
    value: "1",
    children: [{ value: "2", children: [{ value: "3", children: [] }] }],
  }
  const runtime = fromProcessor!(stored) as any
  expect(runtime).toEqual({
    value: 1n,
    children: [{ value: 2n, children: [{ value: 3n, children: [] }] }],
  })
  expect(toProcessor!(runtime)).toEqual(stored)
})

test("processor presence propagates across mutual recursion regardless of discovery order", () => {
  const codec = createTestChecker((value) => `decoded:${value}`)
  let left!: TypeChecker
  let right!: TypeChecker

  left = createTestChecker(
    snapshotProcessorPlan(
      () => [right],
      ([rightProcessor]) => rightProcessor
    )
  )
  right = createTestChecker(
    snapshotProcessorPlan(
      () => [left, codec],
      ([, codecProcessor]) => codecProcessor
    )
  )

  expect(left.getFromSnapshotProcessor()?.("value")).toBe("decoded:value")
})

test("processor plan discovery can be retried after a lazy dependency throws", () => {
  const dependency = createTestChecker((value) => `decoded:${value}`)
  let shouldThrow = true
  const checker = createTestChecker(
    snapshotProcessorPlan(
      () => {
        if (shouldThrow) {
          shouldThrow = false
          throw new Error("not initialized")
        }
        return [dependency]
      },
      ([processor]) => processor
    )
  )

  expect(() => checker.getFromSnapshotProcessor()).toThrow("not initialized")
  expect(checker.getFromSnapshotProcessor()?.("value")).toBe("decoded:value")
})

test("nested output processors retain child object caching", () => {
  let childCalls = 0
  const child = createTestChecker(undefined, (value) => {
    childCalls++
    return { ...value, processed: true }
  })
  const parent = createTestChecker(
    undefined,
    snapshotProcessorPlan(
      () => [child],
      ([childProcessor]) =>
        (value) => [childProcessor!(value[0])]
    )
  )
  const childValue = {}

  expect(parent.toSnapshotProcessor([childValue])).toEqual([{ processed: true }])
  expect(parent.toSnapshotProcessor([childValue])).toEqual([{ processed: true }])
  expect(childCalls).toBe(1)
})

test("or processors preserve nullish processor results", () => {
  const branch = createTestChecker(
    () => undefined,
    () => null,
    true
  )
  const union = types.or(() => branch as any, branch as any)
  const checker = resolveTypeChecker(union)

  expect(branch.getFromSnapshotProcessor()?.("value")).toBeUndefined()
  expect(branch.getToSnapshotProcessor()?.("value")).toBeNull()
  expect(checker.getFromSnapshotProcessor()?.("value")).toBeUndefined()
  expect(checker.getToSnapshotProcessor()?.("value")).toBeNull()
})

test("ArraySet and ObjectMap types keep child object schemas lazy", () => {
  const wrapTypes = [types.arraySet, types.objectMap] as const

  for (const wrapType of wrapTypes) {
    let schemaCalls = 0
    let rightType: any
    const leftType = types.object(() => {
      schemaCalls++
      return { right: rightType }
    })

    const wrappedType = wrapType(leftType)
    expect(schemaCalls).toBe(0)

    rightType = types.string
    resolveTypeChecker(wrappedType)
    expect(schemaCalls).toBeGreaterThan(0)
    expect(resolveTypeChecker(leftType).check({ right: "value" }, [], undefined)).toBeNull()
    expect(resolveTypeChecker(leftType).check({ right: undefined }, [], undefined)).not.toBeNull()
  }
})
