import type { IObservableArray } from "mobx"
import { mayRequireTypeChecking } from "./treeUtils"

/**
 * One part of a native list diff.
 * @internal
 */
export interface ListDeltaPart {
  readonly retain?: number
  readonly delete?: number
  readonly insert?: readonly unknown[]
}

/**
 * Builds the list produced by a native diff, retaining unchanged values.
 * @internal
 */
export function applyListDeltaToSnapshot(
  previous: readonly unknown[],
  delta: readonly ListDeltaPart[],
  convert: (value: unknown) => unknown
): unknown[] {
  const result: unknown[] = []
  let oldIndex = 0
  for (const change of delta) {
    const retainEnd = oldIndex + (change.retain ?? 0)
    while (oldIndex < retainEnd) result.push(previous[oldIndex++])
    oldIndex += change.delete ?? 0
    for (const value of change.insert ?? []) result.push(convert(value))
  }
  while (oldIndex < previous.length) result.push(previous[oldIndex++])
  return result
}

/**
 * Applies a native list diff to a tree array with one splice per edited range.
 * @internal
 */
export function applyListDeltaToArray(
  target: IObservableArray<unknown>,
  delta: readonly ListDeltaPart[],
  convert: (value: unknown) => unknown
): void {
  // Separate splices can violate refinements between them. For typed trees,
  // combine edits separated by retained values into one splice instead.
  let combineSplices = false
  let hasEdit = false
  let retainedAfterEdit = false
  for (const change of delta) {
    if (change.retain && hasEdit) retainedAfterEdit = true
    if (change.insert?.length || change.delete) {
      if (retainedAfterEdit) {
        combineSplices = mayRequireTypeChecking(target)
        break
      }
      hasEdit = true
    }
  }

  let currentIndex = 0
  let deleteCount = 0
  let values: unknown[] = []

  const flushSplice = () => {
    if (values.length === 0) {
      if (deleteCount > 0) target.splice(currentIndex, deleteCount)
    } else {
      // Apply a replacement in one mutation so refinements see its final
      // contents, including when the inserted range is very large.
      target.spliceWithArray(currentIndex, deleteCount, values)
      currentIndex += values.length
    }
    deleteCount = 0
    values = []
  }

  for (const change of delta) {
    if (change.retain) {
      if (combineSplices && (deleteCount > 0 || values.length > 0)) {
        // Include retained values between edits in one splice. This preserves
        // their identities and validates only the completed changed range.
        for (let i = 0; i < change.retain; i++) {
          values.push(target[currentIndex + deleteCount + i])
        }
        deleteCount += change.retain
      } else {
        flushSplice()
        currentIndex += change.retain
      }
    }
    deleteCount += change.delete ?? 0
    for (const value of change.insert ?? []) values.push(convert(value))
  }
  flushSplice()
}
