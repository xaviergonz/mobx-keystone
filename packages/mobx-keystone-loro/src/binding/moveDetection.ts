import { getSnapshotModelId, type Patch, type Path, type SnapshotOutOf } from "mobx-keystone"

/**
 * Represents a move operation to be applied to a LoroMovableList.
 */
export interface MoveOperation {
  /**
   * Path to the list containing the moved item.
   */
  readonly path: Path

  /**
   * Original index of the item.
   */
  readonly fromIndex: number

  /**
   * Target index for the item.
   */
  readonly toIndex: number
}

/**
 * Result of move detection.
 */
export interface MoveDetectionResult {
  /**
   * Patches that should be applied normally (not moves).
   */
  readonly regularPatches: readonly Patch[]

  /**
   * Move operations detected.
   */
  readonly moveOperations: readonly MoveOperation[]
}

/**
 * Gets an array value at a path in a snapshot.
 */
function getArrayAtPath(snapshot: unknown, path: Path): unknown[] | undefined {
  let current: unknown = snapshot
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string | number, unknown>)[key]
  }
  return Array.isArray(current) ? current : undefined
}

/**
 * Groups patches by their parent path (for arrays).
 */
function groupPatchesByArrayPath(patches: Patch[]): Map<string, Patch[]> {
  const groups = new Map<string, Patch[]>()

  for (const patch of patches) {
    if (patch.path.length < 2) {
      // Not a deep enough path to be an array item patch
      continue
    }

    const parentPath = patch.path.slice(0, -1)
    const key = JSON.stringify(parentPath)

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(patch)
  }

  return groups
}

/**
 * Detects move operations from patches by comparing $modelId values.
 *
 * When an item is moved in an array:
 * 1. mobx-keystone generates remove + add patches
 * 2. We detect if the added item has the same $modelId as a removed item
 * 3. If so, we convert to a move operation
 *
 * @param patches The patches from mobx-keystone
 * @param previousSnapshot The snapshot before the change
 * @param currentSnapshot The snapshot after the change
 * @returns Regular patches and detected move operations
 */
export function detectMoves(
  patches: Patch[],
  previousSnapshot: SnapshotOutOf<unknown>,
  currentSnapshot: SnapshotOutOf<unknown>
): MoveDetectionResult {
  // First, expand any "replace length" patches into individual "remove" patches
  // to make move detection easier and more consistent.
  const expandedPatches: Patch[] = []
  for (const patch of patches) {
    if (patch.op === "replace" && patch.path[patch.path.length - 1] === "length") {
      const parentPath = patch.path.slice(0, -1)
      const prevArray = getArrayAtPath(previousSnapshot, parentPath)
      if (prevArray) {
        const newLength = Number(patch.value)
        const oldLength = prevArray.length
        if (newLength < oldLength) {
          // We must remove from end to beginning to keep indices stable
          for (let i = oldLength - 1; i >= newLength; i--) {
            expandedPatches.push({
              op: "remove",
              path: [...parentPath, i],
            })
          }
          continue
        }
      }
    }
    expandedPatches.push(patch)
  }

  const regularPatches: Patch[] = []
  const moveOperations: MoveOperation[] = []
  const processedPatches = new Set<Patch>()

  // Group patches by parent array path
  const patchGroups = groupPatchesByArrayPath(expandedPatches)

  for (const [pathKey, groupPatches] of patchGroups) {
    const parentPath = JSON.parse(pathKey) as Path

    // Get the arrays before and after
    const prevArray = getArrayAtPath(previousSnapshot, parentPath)
    const currArray = getArrayAtPath(currentSnapshot, parentPath)

    if (!prevArray || !currArray) {
      // Not arrays, skip move detection for this group
      continue
    }

    // Build $modelId maps
    const prevIdToIndex = new Map<string, number>()
    const currIdToIndex = new Map<string, number>()

    for (let i = 0; i < prevArray.length; i++) {
      const id = getSnapshotModelId(prevArray[i])
      if (id) {
        prevIdToIndex.set(id, i)
      }
    }

    for (let i = 0; i < currArray.length; i++) {
      const id = getSnapshotModelId(currArray[i])
      if (id) {
        currIdToIndex.set(id, i)
      }
    }

    // Find removes and adds
    const removes: { patch: Patch; index: number; modelId?: string; patchIndex: number }[] = []
    const adds: { patch: Patch; index: number; modelId?: string; patchIndex: number }[] = []

    for (let i = 0; i < groupPatches.length; i++) {
      const patch = groupPatches[i]!
      const index = patch.path[patch.path.length - 1] as number

      if (patch.op === "remove") {
        const prevItem = prevArray[index]
        const modelId = getSnapshotModelId(prevItem)
        removes.push({ patch, index, modelId, patchIndex: i })
      } else if (patch.op === "add") {
        const modelId = getSnapshotModelId(patch.value)
        adds.push({ patch, index, modelId, patchIndex: i })
      }
    }

    // Match removes with adds by $modelId
    // We only match a remove with an add that appears AFTER it in the patch stream
    for (const remove of removes) {
      if (!remove.modelId) {
        continue
      }

      const matchingAdd = adds.find(
        (add) =>
          add.modelId === remove.modelId &&
          add.patchIndex > remove.patchIndex &&
          !processedPatches.has(add.patch)
      )

      if (matchingAdd) {
        // This is a move!
        processedPatches.add(remove.patch)
        processedPatches.add(matchingAdd.patch)

        moveOperations.push({
          path: parentPath,
          fromIndex: remove.index,
          toIndex: matchingAdd.index,
        })
      }
    }
  }

  // Add all patches that weren't processed as moves, preserving original order
  for (const patch of expandedPatches) {
    if (!processedPatches.has(patch)) {
      regularPatches.push(patch)
    }
  }

  return { regularPatches, moveOperations }
}
