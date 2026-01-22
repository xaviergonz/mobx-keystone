import {
  ArraySpliceChange,
  ArrayUpdateChange,
  DeepChange,
  DeepChangeType,
  getSnapshot,
  isTreeNode,
  ObjectAddChange,
  ObjectRemoveChange,
  ObjectUpdateChange,
} from "mobx-keystone"

/**
 * Enhanced deep change types that include snapshots captured at emission time.
 *
 * This is needed because DeepChange events contain live object references.
 * If code does:
 *   boundObject.items = [A, B]
 *   boundObject.items.splice(0, 1)
 *
 * The ObjectUpdate for `items` captures a live reference to the array.
 * By the time we process it in onSnapshot, the array has been mutated.
 * Capturing the snapshot synchronously when the change is emitted solves this.
 */

export interface EnhancedArraySpliceChange extends ArraySpliceChange {
  /** Snapshots of added values, captured at emission time */
  readonly addedSnapshots: unknown[]
}

export interface EnhancedArrayUpdateChange extends ArrayUpdateChange {
  /** Snapshot of new value, captured at emission time (undefined for primitives) */
  readonly newValueSnapshot: unknown
}

export interface EnhancedObjectAddChange extends ObjectAddChange {
  /** Snapshot of new value, captured at emission time (undefined for primitives) */
  readonly newValueSnapshot: unknown
}

export interface EnhancedObjectUpdateChange extends ObjectUpdateChange {
  /** Snapshot of new value, captured at emission time (undefined for primitives) */
  readonly newValueSnapshot: unknown
}

// ObjectRemove doesn't need enhancement - we only care about the old value which is already detached

export type EnhancedDeepChange =
  | EnhancedArraySpliceChange
  | EnhancedArrayUpdateChange
  | EnhancedObjectAddChange
  | EnhancedObjectUpdateChange
  | ObjectRemoveChange

/**
 * Get the snapshot of a value.
 * For tree nodes (models, data models, tweaked arrays/objects): returns the mobx-keystone snapshot
 * For other values (primitives, plain objects): returns the value itself
 */
function getValueSnapshot(value: unknown): unknown {
  if (isTreeNode(value)) {
    return getSnapshot(value)
  }
  // For primitives and non-tree objects, return as-is
  return value
}

/**
 * Enhances a DeepChange by capturing snapshots of new values at the current moment.
 * This should be called synchronously when the change is received to capture
 * the state before any subsequent mutations.
 */
export function enhanceDeepChange(change: DeepChange): EnhancedDeepChange {
  switch (change.type) {
    case DeepChangeType.ArraySplice: {
      const addedSnapshots = change.addedValues.map((value) => getValueSnapshot(value))
      return {
        ...change,
        addedSnapshots,
      }
    }

    case DeepChangeType.ArrayUpdate: {
      return {
        ...change,
        newValueSnapshot: getValueSnapshot(change.newValue),
      }
    }

    case DeepChangeType.ObjectAdd: {
      return {
        ...change,
        newValueSnapshot: getValueSnapshot(change.newValue),
      }
    }

    case DeepChangeType.ObjectUpdate: {
      return {
        ...change,
        newValueSnapshot: getValueSnapshot(change.newValue),
      }
    }

    case DeepChangeType.ObjectRemove: {
      // No enhancement needed
      return change
    }
  }
}
