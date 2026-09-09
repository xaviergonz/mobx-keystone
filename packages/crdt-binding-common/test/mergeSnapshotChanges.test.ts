import { getSnapshot, idProp, Model, model, tProp } from "mobx-keystone"
import { mergeSnapshotChanges as merge } from "../src"

test("unchanged native snapshots retain model defaults and omitted processed fields", () => {
  const model = { local: 7, values: [1, 2] }
  expect(merge({ omitted: 1 }, { omitted: 1 }, model)).toBe(model)
})

test("native field changes preserve unrelated nested model initialization edits", () => {
  const untouched = { local: 7 }
  const result = merge(
    { nested: { value: 1 }, removed: 1 },
    { nested: { value: 2 }, added: undefined },
    { nested: { value: 3, local: 7 }, removed: 2, untouched }
  )
  expect(result).toEqual({ nested: { value: 2, local: 7 }, added: undefined, untouched })
  expect((result as { untouched: object }).untouched).toBe(untouched)
})

test("native array changes replace overlapping model array edits", () => {
  expect(merge({ values: [1] }, { values: [1, 2] }, { values: [1, 3], local: 7 })).toEqual({
    values: [1, 2],
    local: 7,
  })
})

test("native special keys remain own data properties", () => {
  const before = JSON.parse('{"__proto__": 1, "toString": 1}')
  const after = JSON.parse('{"__proto__": 2, "toString": 2}')
  const result = merge(before, after, {})
  expect(result).toEqual(after)
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
  expect(Object.hasOwn(result as object, "__proto__")).toBe(true)
})

test("native frozen replacements remain atomic", () => {
  const before = { $frozen: true, data: { a: 1, b: 1 } }
  const after = { $frozen: true, data: { a: 2, b: 1 } }
  const model = { $frozen: true, data: { a: 1, b: 2 } }
  expect(merge(before, after, model)).toBe(after)
})

test("native object edits replace an overlapping initialized frozen value atomically", () => {
  const before = { value: 1 }
  const after = { value: 2 }
  const initialized = { $frozen: true, data: { local: 7 } }
  expect(merge(before, after, initialized)).toBe(after)
  expect(merge(before, { value: 1 }, initialized)).toBe(initialized)
})

@model("crdt-binding-common/merge-identity-first")
class First extends Model({ key: idProp, count: tProp(0) }) {}
@model("crdt-binding-common/merge-identity-second")
class Second extends Model({ key: idProp, count: tProp(0) }) {}

test.each([
  ["ID", () => getSnapshot(new First({ key: "replacement" }))],
  ["type", () => getSnapshot(new Second({ key: "original" }))],
] as const)("native model %s changes replace old initialization data", (_, replacement) => {
  const before = getSnapshot(new First({ key: "original" }))
  const initialized = { ...before, count: 1, local: 7 }
  const after = replacement()
  expect(merge(before, after, initialized)).toBe(after)
})

test("unchanged native model identity preserves unrelated initialization data", () => {
  const before = getSnapshot(new First({ key: "original" }))
  const initialized = { ...before, count: 1, local: 7 }
  expect(merge(before, { ...before, count: 2 }, initialized)).toEqual({ ...initialized, count: 2 })
})

test("removing native model metadata discards old model initialization edits", () => {
  const before = getSnapshot(new First({ key: "original" }))
  const after = { key: "original", count: 0 }
  expect(merge(before, after, { ...before, count: 1, local: 7 })).toBe(after)
})

test("adding native model metadata discards plain-object initialization edits", () => {
  const before = { key: "original", count: 0 }
  const after = getSnapshot(new First({ key: "original" }))
  expect(merge(before, after, { ...before, count: 7 })).toBe(after)
})

test("publishing inferred model metadata retains that model's initialization edits", () => {
  const before = { key: "original", count: 0 }
  const after = getSnapshot(new First({ key: "original" }))
  const initialized = { ...after, count: 1, local: 7 }
  expect(merge(before, after, initialized)).toEqual(initialized)
})

test.each([
  [
    [0, 0, 0],
    [1, 0, 2],
    [0, 9, 0],
    [1, 9, 2],
  ],
  [
    [0, 1, 2],
    [0, 3, 4, 2],
    [9, 1, 8],
    [9, 3, 4, 8],
  ],
  [
    [0, 1, 2],
    [0, 2],
    [9, 1, 8],
    [9, 8],
  ],
])(
  "reentrant array reconciliation preserves native values outside the local edit",
  (before, after, native, expected) => {
    expect(merge({ values: before }, { values: after }, { values: native }, "merge")).toEqual({
      values: expected,
    })
  }
)

test("reentrant array reconciliation retains unchanged native arrays", () => {
  const native = [9, 8]
  expect(merge([0, 0], [0, 0], native, "merge")).toBe(native)
})

test("reentrant model reordering retains pending native fields by model identity", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const nativeB = { ...b, count: 9 }
  expect(merge([a, b], [b, a], [a, nativeB], "merge")).toEqual([nativeB, a])
})

test("reentrant insertion and reordering retain pending native model fields", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const nativeB = { ...b, count: 9 }
  expect(merge([a, b], [c, b, a], [a, nativeB], "merge")).toEqual([c, nativeB, a])
})

test("reentrant moves distinguish model types with the same ID", () => {
  const a = getSnapshot(new First({ key: "same" }))
  const b = getSnapshot(new Second({ key: "same" }))
  const nativeA = { ...a, count: 3 }
  const nativeB = { ...b, count: 9 }
  expect(merge([a, b], [b, a], [nativeA, nativeB], "merge")).toEqual([nativeB, nativeA])
})

test.each(["replace", "merge"] as const)(
  "model identity conflicts apply the changed source atomically (array policy: %s)",
  (arrayPolicy) => {
    const before = getSnapshot(new First({ key: "original" }))
    const after = { ...before, count: 2 }
    const replacement = getSnapshot(new First({ key: "replacement", count: 9 }))
    expect(merge(before, after, replacement, arrayPolicy)).toBe(after)
  }
)

test("model-to-plain conflicts apply the changed source atomically", () => {
  const before = getSnapshot(new First({ key: "original" }))
  const replacement = { count: 9 }
  const after = { ...before, count: 2 }
  expect(merge(before, after, replacement, "merge")).toBe(after)
})

test("unchanged source copies preserve concurrent model replacements", () => {
  const before = getSnapshot(new First({ key: "original" }))
  const replacement = getSnapshot(new First({ key: "replacement", count: 9 }))
  expect(merge(before, { ...before }, replacement, "merge")).toBe(replacement)
})

test("model field edits follow a pending native reorder", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const changedA = { ...a, count: 2 }
  expect(merge([a, b], [changedA, b], [b, a], "merge")).toEqual([b, changedA])
})

test("multiple model field edits preserve a pending native reorder", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const changedA = { ...a, count: 2 }
  const changedB = { ...b, count: 3 }
  expect(merge([a, b], [changedA, changedB], [b, a], "merge")).toEqual([changedB, changedA])
})

test("model field edits retain pending native insertions", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const changedA = { ...a, count: 2 }
  expect(merge([a, b], [changedA, b], [c, a, b], "merge")).toEqual([c, changedA, b])
})

test("model field edits retain pending deletion of an unrelated model", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const changedB = { ...b, count: 2 }
  expect(merge([a, b], [a, changedB], [b], "merge")).toEqual([changedB])
})

test("editing a natively deleted model restores it without overwriting surviving models", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const changedA = { ...a, count: 2 }
  expect(merge([a, b], [changedA, b], [b], "merge")).toEqual([changedA, b])
})

test("restoring a deleted trailing model does not create sparse array entries", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const changedC = { ...c, count: 2 }
  expect(merge([a, b, c], [a, b, changedC], [a], "merge")).toEqual([a, changedC])
})

test("multiple deleted model edits retain surviving native models and new values", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const d = getSnapshot(new First({ key: "d" }))
  const changedA = { ...a, count: 2 }
  const changedB = { ...b, count: 3 }
  expect(merge([a, b, c], [changedA, changedB, c], [c, d], "merge")).toEqual([
    changedA,
    changedB,
    c,
    d,
  ])
})

test("restored model edits replace conflicting new models atomically", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const replacement = getSnapshot(new First({ key: "replacement", count: 9 }))
  const changedA = { ...a, count: 2 }
  expect(merge([a, b], [changedA, b], [replacement, b], "merge")).toEqual([changedA, b])
})

test("bulk model restoration retains the final native survivor", () => {
  const before = Array.from({ length: 2000 }, (_, i) => getSnapshot(new First({ key: String(i) })))
  const after = before.map((value, i) => (i === before.length - 1 ? value : { ...value, count: 2 }))
  const survivor = before[before.length - 1]
  const result = merge(before, after, [survivor], "merge") as unknown[]
  expect(result).toEqual(after)
  expect(result[result.length - 1]).toBe(survivor)
})

test("restored models follow a surviving predecessor shifted by native insertion", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const changedB = { ...b, count: 2 }
  expect(merge([a, b], [a, changedB], [c, a], "merge")).toEqual([c, a, changedB])
})

test("restored models precede their surviving successor after native reordering", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const changedA = { ...a, count: 2 }
  expect(merge([a, b, c], [changedA, b, c], [c, b], "merge")).toEqual([c, changedA, b])
})

test("restoration preserves a native replacement corresponding to another deleted model", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const d = getSnapshot(new First({ key: "d" }))
  const e = getSnapshot(new First({ key: "e" }))
  const changedB = { ...b, count: 2 }
  expect(merge([a, b, c, d], [a, changedB, c, d], [a, e, d], "merge")).toEqual([a, changedB, e, d])
})

test("model field edits retain native order alongside a primitive edit", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const changedA = { ...a, count: 2 }
  expect(merge([a, 0, b], [changedA, 1, b], [b, 0, a], "merge")).toEqual([b, 1, changedA])
})

test("edits to natively deleted primitive entries restore a dense array", () => {
  expect(merge([1, 2, 3], [1, 2, 4], [1], "merge")).toEqual([1, 4])
  expect(merge([1, 2, 3], [1, 8, 9], [], "merge")).toEqual([8, 9])
})

test("positional conflicts do not retain a stale second copy of an edited model", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const changedA = { ...a, count: 2 }
  expect(merge([a, 0, b, c], [changedA, 1, b, c], [b, c, 0, a], "merge")).toEqual([changedA, 1, 0])
})

test("inserted model spans remove stale native copies outside the span", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const d = getSnapshot(new First({ key: "d" }))
  const e = getSnapshot(new First({ key: "e" }))
  expect(merge([a, b, c, d], [b, a, e, c, d], [b, c, d, a], "merge")).toEqual([b, a, e, d])
})

test("local model copies take precedence over earlier native copies", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const changedA = { ...a, count: 2 }
  expect(merge([c, b, 0, a], [c, b, 1, changedA], [a, 0, c, b], "merge")).toEqual([0, 1, changedA])
})

test("model span deduplication uses the shortened native prefix length", () => {
  const a = getSnapshot(new First({ key: "a" }))
  const b = getSnapshot(new First({ key: "b" }))
  const c = getSnapshot(new First({ key: "c" }))
  const changedA = { ...a, count: 2 }
  expect(merge([0, 0, a, b], [0, 0, changedA, c, b], [a], "merge")).toEqual([changedA, c])
})
