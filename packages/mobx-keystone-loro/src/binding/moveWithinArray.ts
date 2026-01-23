import { DeepChange } from "mobx-keystone"

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
 * When set, the next two splice operations on this array are intercepted.
 */
let activeMoveContext:
  | {
      array: unknown[]
      fromIndex: number
      toIndex: number
      path: readonly (string | number)[] | undefined // Captured from first splice
      receivedFirstSplice: boolean
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
  if (fromIndex < 0 || fromIndex >= array.length) {
    throw new Error(`fromIndex ${fromIndex} is out of bounds (array length: ${array.length})`)
  }
  if (toIndex < 0 || toIndex > array.length) {
    throw new Error(`toIndex ${toIndex} is out of bounds (array length: ${array.length})`)
  }
  if (fromIndex === toIndex) {
    return // No-op
  }

  // Set up the move context before mutations
  activeMoveContext = {
    array,
    fromIndex,
    toIndex,
    path: undefined,
    receivedFirstSplice: false,
  }

  try {
    // Perform the actual splice operations
    // This will trigger onDeepChange for each splice
    const [item] = array.splice(fromIndex, 1)
    const adjustedTarget = toIndex > fromIndex ? toIndex - 1 : toIndex
    array.splice(adjustedTarget, 0, item)
  } finally {
    activeMoveContext = undefined
  }
}

/**
 * Check if a change is part of an active move operation and process it.
 * This is called for ArraySplice changes on the target array.
 *
 * @param change The deep change (must be ArraySplice type)
 * @returns The ArrayMoveChange if the move is complete (second splice),
 *          undefined if intercepted but not complete (first splice)
 */
export function processChangeForMove(change: DeepChange): ArrayMoveChange | undefined {
  // We know we're in a move context and this is an ArraySplice on the target array
  const ctx = activeMoveContext!

  if (!ctx.receivedFirstSplice) {
    // First splice - capture the path and mark as received
    ctx.path = change.path
    ctx.receivedFirstSplice = true
    return undefined
  }

  // Second splice - the move is complete.
  // Note: We adjust toIndex here for Loro's move() semantics, which expects
  // the target position after removal. This is intentionally separate from
  // the adjustment on line 64, which is for the splice operation on the MobX array.
  // Both adjustments are needed because:
  // - Line 64: splice() inserts at a position in the already-shortened array
  // - Here: Loro's move(from, to) also expects `to` as the position after removal
  const adjustedToIndex = ctx.toIndex > ctx.fromIndex ? ctx.toIndex - 1 : ctx.toIndex

  return {
    type: "ArrayMove",
    path: ctx.path!,
    fromIndex: ctx.fromIndex,
    toIndex: adjustedToIndex,
  }
}

/**
 * Check if we're currently in a move context for a specific array.
 */
export function isInMoveContextForArray(array: unknown[]): boolean {
  return activeMoveContext !== undefined && activeMoveContext.array === array
}
