import { getSnapshotModelTypeAndId } from "mobx-keystone"
import { jsonEquals } from "./jsonEquals"

function isObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Index identified models once, so reordering does not require repeated array scans.
 * @internal
 */
export function indexModelSnapshots(snapshots: readonly unknown[]) {
  const result = new Map<string, Map<string, { snapshot: unknown; index: number }>>()
  snapshots.forEach((snapshot, index) => {
    const model = getSnapshotModelTypeAndId(snapshot)
    if (model?.modelId === undefined) return
    let byId = result.get(model.modelType)
    if (!byId) result.set(model.modelType, (byId = new Map()))
    byId.set(model.modelId, { snapshot, index })
  })
  return result
}

/** A positional source write supersedes stale copies of that model outside its span. */
function removeStaleModelCopies(result: unknown[], localIndices: number[] | undefined): unknown[] {
  if (!localIndices) return result
  const localModels = indexModelSnapshots(localIndices.map((index) => result[index]))
  const written = new Set(localIndices)
  let retained: unknown[] | undefined
  for (let i = 0; i < result.length; i++) {
    const model = written.has(i) ? undefined : getSnapshotModelTypeAndId(result[i])
    if (model?.modelId !== undefined && localModels.get(model.modelType)?.has(model.modelId)) {
      retained ??= result.slice(0, i)
    } else if (retained) {
      retained.push(result[i])
    }
  }
  return retained ?? result
}

/** Preserve native model ordering while merging field edits and positional non-model edits. */
function mergeModelFieldChanges(
  before: unknown[],
  after: unknown[],
  native: unknown[],
  start: number,
  end: number
): unknown[] | undefined {
  let nativeModels: ReturnType<typeof indexModelSnapshots> | undefined
  const edits: { sourceIndex: number; nativeIndex: number | undefined }[] = []
  for (let i = start; i < end; i++) {
    if (jsonEquals(before[i], after[i])) continue
    const previous = getSnapshotModelTypeAndId(before[i])
    const current = getSnapshotModelTypeAndId(after[i])
    if (!previous && !current) {
      // Non-model edits remain positional. Do not let them overwrite a native
      // model that may also receive an identity-based field edit below.
      if (i >= native.length || getSnapshotModelTypeAndId(native[i])) return undefined
      edits.push({ sourceIndex: i, nativeIndex: i })
      continue
    }
    if (
      previous?.modelId === undefined ||
      !current ||
      previous.modelType !== current.modelType ||
      previous.modelId !== current.modelId
    )
      return undefined
    nativeModels ??= indexModelSnapshots(native)
    const target = nativeModels.get(current.modelType)?.get(current.modelId)
    edits.push({ sourceIndex: i, nativeIndex: target?.index })
  }
  const result = native.slice()
  const missing: number[] = []
  for (const { sourceIndex, nativeIndex } of edits) {
    if (nativeIndex === undefined) {
      missing.push(sourceIndex)
      continue
    }
    result[nativeIndex] = mergeSnapshotChanges(
      before[sourceIndex],
      after[sourceIndex],
      native[nativeIndex],
      "merge"
    )
  }
  if (missing.length === 0) return result

  // Anchor restored models to surviving neighbors rather than stale indices.
  // New values in the corresponding gap are conflicting replacements; existing
  // models remain in their native order. All passes below are linear.
  const previousModels = indexModelSnapshots(before)
  const retained = result.map((value) => {
    const model = getSnapshotModelTypeAndId(value)
    return (
      model?.modelId !== undefined &&
      (previousModels.get(model.modelType)?.has(model.modelId) ?? false)
    )
  })
  const gapStarts = [0]
  for (let i = 0; i < result.length; i++) {
    gapStarts.push(retained[i] ? i + 1 : gapStarts[i])
  }
  const positions = before.map((value) => {
    const model = getSnapshotModelTypeAndId(value)
    return model?.modelId === undefined
      ? undefined
      : nativeModels?.get(model.modelType)?.get(model.modelId)?.index
  })
  const following = new Array<number>(before.length)
  let next = -1
  for (let i = before.length - 1; i >= 0; i--) {
    following[i] = next
    if (positions[i] !== undefined) next = i
  }
  const insertions: ({ values: unknown[]; replace: boolean } | undefined)[] = new Array(
    result.length + 1
  )
  let previous = -1
  let missingIndex = 0
  for (let i = 0; i < before.length; i++) {
    if (missing[missingIndex] === i) {
      const next = following[i]
      const rawIndex =
        next >= 0
          ? positions[next]! - (next - i)
          : previous >= 0
            ? positions[previous]! + i - previous
            : i
      const index =
        next >= 0
          ? Math.max(gapStarts[positions[next]!], rawIndex)
          : Math.min(result.length, rawIndex)
      const insertion = insertions[index] ?? (insertions[index] = { values: [], replace: false })
      insertion.values.push(after[i])
      // A clamped position inserts before the gap; its first native value may
      // be a replacement for a different deleted model.
      insertion.replace ||= rawIndex === index
      missingIndex++
    }
    if (positions[i] !== undefined) previous = i
  }
  const restored: unknown[] = []
  for (let i = 0; i <= result.length; i++) {
    const inserted = insertions[i]
    if (inserted) for (const value of inserted.values) restored.push(value)
    if (i < result.length && (!inserted?.replace || retained[i])) restored.push(result[i])
  }
  return restored
}

/**
 * How source array edits are applied to the destination.
 * - `replace`: Changed arrays replace the destination atomically (initialization).
 * - `merge`: Apply changed spans and model field edits while retaining unrelated
 *   destination values and model ordering (reentrant runtime changes).
 */
export type SnapshotArrayMergePolicy = "replace" | "merge"

/**
 * Apply changes from `base` to `changed` over `destination`.
 * Source changes win at overlapping fields; unchanged fields retain destination
 * values. Model replacements and frozen values remain atomic under either policy.
 * Unchanged snapshot references are preserved where possible.
 */
export function mergeSnapshotChanges(
  base: unknown,
  changed: unknown,
  destination: unknown,
  arrayPolicy: SnapshotArrayMergePolicy = "replace"
): unknown {
  if (Object.is(base, changed)) return destination
  if (
    arrayPolicy === "merge" &&
    Array.isArray(base) &&
    Array.isArray(changed) &&
    Array.isArray(destination)
  ) {
    let start = 0
    while (start < base.length && start < changed.length && jsonEquals(base[start], changed[start]))
      start++
    if (start === base.length && start === changed.length) return destination
    let endBefore = base.length
    let endAfter = changed.length
    while (
      endBefore > start &&
      endAfter > start &&
      jsonEquals(base[endBefore - 1], changed[endAfter - 1])
    ) {
      endBefore--
      endAfter--
    }
    let beforeModels: ReturnType<typeof indexModelSnapshots> | undefined
    let nativeModels: ReturnType<typeof indexModelSnapshots> | undefined
    let localModelIndices: number[] | undefined
    const mergeItem = (index: number, fallback: () => unknown, resultIndex: number) => {
      const model = getSnapshotModelTypeAndId(changed[index])
      if (model?.modelId !== undefined) {
        ;(localModelIndices ??= []).push(resultIndex)
        beforeModels ??= indexModelSnapshots(base)
        nativeModels ??= indexModelSnapshots(destination)
        const previous = beforeModels.get(model.modelType)?.get(model.modelId)
        const native = nativeModels.get(model.modelType)?.get(model.modelId)
        if (previous && native) {
          return mergeSnapshotChanges(previous.snapshot, changed[index], native.snapshot, "merge")
        }
      }
      return fallback()
    }
    if (base.length === changed.length) {
      const fieldChanges = mergeModelFieldChanges(base, changed, destination, start, endAfter)
      if (fieldChanges) return fieldChanges
      const result = destination.slice()
      for (let i = start; i < endAfter; i++) {
        if (!jsonEquals(base[i], changed[i])) {
          // Native deletions may have removed this position. Restore edited
          // values at the end without introducing unsupported sparse entries.
          const destinationIndex = Math.min(i, result.length)
          result[destinationIndex] = mergeItem(
            i,
            () => mergeSnapshotChanges(base[i], changed[i], destination[i], "merge"),
            destinationIndex
          )
        }
      }
      return removeStaleModelCopies(result, localModelIndices)
    }
    // Replay the local changed span at its original index. Preserve native
    // values outside that span, without spreading items into function arguments.
    const prefix = destination.slice(0, start)
    const result = [
      ...prefix,
      ...changed
        .slice(start, endAfter)
        .map((value, index) => mergeItem(start + index, () => value, prefix.length + index)),
      ...destination.slice(endBefore),
    ]
    return removeStaleModelCopies(result, localModelIndices)
  }
  if (
    !isObject(base) ||
    !isObject(changed) ||
    !isObject(destination) ||
    base.$frozen === true ||
    changed.$frozen === true ||
    destination.$frozen === true
  ) {
    return jsonEquals(base, changed) ? destination : changed
  }

  const beforeModel = getSnapshotModelTypeAndId(base)
  const afterModel = getSnapshotModelTypeAndId(changed)
  // Missing native metadata can be inferred by the supplied model type. Publishing
  // that same metadata does not replace the already initialized model.
  const initializedModel =
    beforeModel || afterModel ? getSnapshotModelTypeAndId(destination) : undefined
  const previousModel = beforeModel ?? initializedModel
  if (
    (previousModel || afterModel) &&
    (!previousModel ||
      !afterModel ||
      previousModel.modelType !== afterModel.modelType ||
      previousModel.modelId !== afterModel.modelId)
  ) {
    // Defaults and onInit edits belong to the old value. A replacement must
    // initialize from its own native snapshot instead of applying them twice.
    return changed
  }

  if (
    beforeModel &&
    (!initializedModel ||
      beforeModel.modelType !== initializedModel.modelType ||
      beforeModel.modelId !== initializedModel.modelId)
  ) {
    // The other side replaced the model. Apply a changed source as a whole,
    // rather than combining its fields with the replacement's identity.
    return jsonEquals(base, changed) ? destination : changed
  }

  let result = destination
  for (const key of Object.keys(base)) {
    if (!Object.hasOwn(changed, key) && Object.hasOwn(result, key)) {
      if (result === destination) result = { ...destination }
      delete result[key]
    }
  }
  for (const key of Object.keys(changed)) {
    // A snapshot processor may omit a native field. An unchanged source field
    // must stay omitted, rather than being reintroduced as undefined.
    if (
      Object.hasOwn(base, key) &&
      !Object.hasOwn(destination, key) &&
      jsonEquals(base[key], changed[key])
    )
      continue
    const value = Object.hasOwn(base, key)
      ? mergeSnapshotChanges(base[key], changed[key], destination[key], arrayPolicy)
      : changed[key]
    if (!Object.hasOwn(result, key) || !Object.is(result[key], value)) {
      if (result === destination) result = { ...destination }
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
  }
  return result
}
