import { DeepChangeType, getModelOrSnapshotTypeAndId, Path } from "mobx-keystone"
import type { EnhancedArraySpliceChange, EnhancedDeepChange } from "./enhanceDeepChange"
import { modelIdentityKey } from "./TreapPositionTracker"

/** Bitmask flags for move detection */
enum MoveFlag {
  Added = 1,
  Removed = 2,
  Moved = Added | Removed, // 3 = both added and removed
}

/**
 * Gets the model identity key from a live model or snapshot.
 * Returns `modelType + "\0" + modelId` or undefined if not a model with ID.
 */
function getModelIdentityKey(value: unknown): string | undefined {
  const typeAndId = getModelOrSnapshotTypeAndId(value)
  if (!typeAndId || typeAndId.modelId === undefined) {
    return undefined
  }
  return modelIdentityKey(typeAndId.modelType, typeAndId.modelId)
}

/**
 * Converts a path to a string key for use in Maps/Sets.
 * Uses a format that distinguishes between string and number segments
 * to avoid collisions (e.g., ["items", 1] vs ["items", "1"]).
 */
function pathToKey(path: Path): string {
  return path.map((s) => (typeof s === "number" ? `n:${s}` : `s:${s}`)).join("\0")
}

/**
 * A change that should be applied directly.
 */
export interface ApplyDirectlyAction {
  type: "applyDirectly"
  change: EnhancedDeepChange
}

/**
 * Array changes that require reconciliation (moves detected).
 */
export interface ReconcileArrayAction {
  type: "reconcileArray"
  path: readonly (string | number)[]
}

export type ChangeAction = ApplyDirectlyAction | ReconcileArrayAction

/**
 * Analyzes changes and returns an ordered list of actions to perform.
 *
 * Move detection algorithm for arrays:
 * 1. For each array path, track which model identity keys are added vs removed
 * 2. If any model is both added AND removed, it's a move requiring reconciliation
 * 3. If models are only added or only removed (not both), apply directly
 * 4. If no models are involved, apply directly
 *
 * The returned actions preserve the original order of changes. Array changes
 * that need reconciliation are grouped at the position of the first change
 * for that path.
 *
 * @param changes Array of enhanced deep changes to analyze
 * @returns Ordered list of actions to perform
 */
export function analyzeChanges(changes: EnhancedDeepChange[]): ChangeAction[] {
  // Track array paths that need reconciliation
  const pathsNeedingReconciliation = new Set<string>()

  // First pass: detect which array paths have moves
  // Internal tracking for array paths
  type ArrayPathInfo = {
    moveFlags: Map<string, number>
    hasMoves: boolean
    path: Path
  }
  const arrayPathInfos = new Map<string, ArrayPathInfo>()

  for (const change of changes) {
    const isArrayChange =
      change.type === DeepChangeType.ArraySplice || change.type === DeepChangeType.ArrayUpdate

    if (!isArrayChange) continue

    const pathKey = pathToKey(change.path)

    let info = arrayPathInfos.get(pathKey)
    if (!info) {
      info = { moveFlags: new Map(), hasMoves: false, path: change.path }
      arrayPathInfos.set(pathKey, info)
    }

    // Skip move detection if we already detected moves for this path
    if (info.hasMoves) continue

    // Detect moves by tracking added/removed model identity keys
    if (change.type === DeepChangeType.ArraySplice) {
      // Mark removed items
      for (const removedValue of change.removedValues) {
        const key = getModelIdentityKey(removedValue)
        if (key !== undefined) {
          const currentFlags = info.moveFlags.get(key) ?? 0
          const newFlags = currentFlags | MoveFlag.Removed
          info.moveFlags.set(key, newFlags)
          if (newFlags === MoveFlag.Moved) {
            info.hasMoves = true
            pathsNeedingReconciliation.add(pathKey)
            break // Early exit
          }
        }
        // Primitives/nulls without model IDs are handled by reconciliation
      }

      if (info.hasMoves) continue

      // Mark added items (use snapshots since live objects may have mutated)
      const spliceChange = change as EnhancedArraySpliceChange
      for (const addedSnapshot of spliceChange.addedSnapshots) {
        const key = getModelIdentityKey(addedSnapshot)
        if (key !== undefined) {
          const currentFlags = info.moveFlags.get(key) ?? 0
          const newFlags = currentFlags | MoveFlag.Added
          info.moveFlags.set(key, newFlags)
          if (newFlags === MoveFlag.Moved) {
            info.hasMoves = true
            pathsNeedingReconciliation.add(pathKey)
            break // Early exit
          }
        }
        // Primitives/nulls without model IDs are handled by reconciliation
      }
    } else if (change.type === DeepChangeType.ArrayUpdate) {
      // ArrayUpdate is like removing oldValue and adding newValue
      const removedKey = getModelIdentityKey(change.oldValue)
      if (removedKey !== undefined) {
        const currentFlags = info.moveFlags.get(removedKey) ?? 0
        const newFlags = currentFlags | MoveFlag.Removed
        info.moveFlags.set(removedKey, newFlags)
        if (newFlags === MoveFlag.Moved) {
          info.hasMoves = true
          pathsNeedingReconciliation.add(pathKey)
        }
      }

      if (!info.hasMoves) {
        const updateChange = change as any // EnhancedArrayUpdateChange
        const addedKey = getModelIdentityKey(updateChange.newValueSnapshot)
        if (addedKey !== undefined) {
          const currentFlags = info.moveFlags.get(addedKey) ?? 0
          const newFlags = currentFlags | MoveFlag.Added
          info.moveFlags.set(addedKey, newFlags)
          if (newFlags === MoveFlag.Moved) {
            info.hasMoves = true
            pathsNeedingReconciliation.add(pathKey)
          }
        }
      }
    }
  }

  // Second pass: build ordered list of actions
  const actions: ChangeAction[] = []
  const emittedReconcilePaths = new Set<string>()

  for (const change of changes) {
    const isArrayChange =
      change.type === DeepChangeType.ArraySplice || change.type === DeepChangeType.ArrayUpdate

    if (!isArrayChange) {
      // Non-array change: apply directly
      actions.push({ type: "applyDirectly", change })
      continue
    }

    const pathKey = pathToKey(change.path)

    if (pathsNeedingReconciliation.has(pathKey)) {
      // This path needs reconciliation - emit once at first occurrence
      if (!emittedReconcilePaths.has(pathKey)) {
        emittedReconcilePaths.add(pathKey)
        actions.push({ type: "reconcileArray", path: change.path })
      }
      // Skip individual changes for this path - reconciliation handles them all
    } else {
      // No moves or has non-ID items - apply array change directly
      actions.push({ type: "applyDirectly", change })
    }
  }

  return actions
}
