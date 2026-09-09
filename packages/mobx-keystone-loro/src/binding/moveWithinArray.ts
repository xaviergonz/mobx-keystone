import { isObservableArray } from "mobx"
import { type DeepChange, DeepChangeType, isTreeNode } from "mobx-keystone"
import { failure } from "../utils/error"
import { loroBindingContext } from "./loroBindingContext"

/**
 * Synthetic change type for array moves.
 */
export interface ArrayMoveChange {
  type: "ArrayMove"
  path: readonly (string | number)[]
  fromIndex: number
  toIndex: number
}

/**
 * Tracks the currently active move operation.
 * When set, the single splice operation on this array is intercepted.
 */
let activeMoveContext:
  | {
      array: unknown[]
      fromIndex: number
      toIndex: number
      removedValues: unknown[]
      addedValues: unknown[]
      capture: (() => void) | undefined
    }
  | undefined

/**
 * Moves an item within an array from one index to another.
 *
 * When used on a mobx-keystone array bound to a Loro movable list,
 * this translates to a native Loro move operation for optimal CRDT merging.
 *
 * For unbound arrays, performs a standard splice-based move.
 *
 * @param array The array to move within
 * @param fromIndex The index of the item to move
 * @param toIndex The target index to move the item to
 */
export function moveWithinArray<T>(array: T[], fromIndex: number, toIndex: number): void {
  // Validate indices
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= array.length) {
    throw failure(`fromIndex ${fromIndex} is out of bounds (array length: ${array.length})`)
  }
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > array.length) {
    throw failure(`toIndex ${toIndex} is out of bounds (array length: ${array.length})`)
  }
  if (fromIndex === toIndex || fromIndex + 1 === toIndex) {
    return // No-op
  }

  const adjustedTarget = toIndex > fromIndex ? toIndex - 1 : toIndex
  if (!isObservableArray(array)) {
    const [item] = array.splice(fromIndex, 1)
    array.splice(adjustedTarget, 0, item)
    return
  }

  // Validate the completed move in one mutation, including fixed-length
  // refinements. The bulk API also avoids argument limits on large moves.
  const start = Math.min(fromIndex, adjustedTarget)
  const end = Math.max(fromIndex, adjustedTarget) + 1
  const removedValues = array.slice(start, end)
  const addedValues = removedValues.slice()
  const [item] = addedValues.splice(fromIndex - start, 1)
  addedValues.splice(adjustedTarget - start, 0, item)
  const finishCapture = isTreeNode(array)
    ? loroBindingContext.get(array)?.captureArrayMove?.(array, fromIndex, adjustedTarget)
    : undefined

  const previousMoveContext = activeMoveContext
  activeMoveContext = {
    array,
    fromIndex,
    toIndex: adjustedTarget,
    removedValues,
    addedValues,
    capture: finishCapture,
  }
  try {
    array.spliceWithArray(start, addedValues.length, addedValues)
  } finally {
    activeMoveContext = previousMoveContext
  }
}

/**
 * Check if a change is part of an active move operation and process it.
 * This is called for ArraySplice changes on the target array.
 *
 * @param change The deep change (must be ArraySplice type)
 * @returns The corresponding native move.
 * @internal
 */
export function processChangeForMove(change: DeepChange): ArrayMoveChange {
  const ctx = activeMoveContext!
  // The binding receives this validated change even if another listener throws.
  // Capture before the helper unwinds, including during reentrant reconciliation.
  ctx.capture?.()
  ctx.capture = undefined

  return {
    type: "ArrayMove",
    path: change.path,
    fromIndex: ctx.fromIndex,
    toIndex: ctx.toIndex,
  }
}

/**
 * Distinguish the helper's splice from other edits made by its listeners.
 * @internal
 */
export function isChangeForMove(change: DeepChange): boolean {
  const ctx = activeMoveContext
  if (!ctx || change.type !== DeepChangeType.ArraySplice || change.target !== ctx.array)
    return false
  return (
    change.index === Math.min(ctx.fromIndex, ctx.toIndex) &&
    change.removedValues.length === ctx.removedValues.length &&
    change.addedValues.length === ctx.addedValues.length &&
    change.removedValues.every((value, index) => Object.is(value, ctx.removedValues[index])) &&
    change.addedValues.every((value, index) => {
      const expected = ctx.addedValues[index]
      // Plain tree objects can be wrapped again when reattached. The removed
      // references still identify the operation; primitive additions must match.
      return (
        (value !== null &&
          typeof value === "object" &&
          expected !== null &&
          typeof expected === "object") ||
        Object.is(value, expected)
      )
    })
  )
}
