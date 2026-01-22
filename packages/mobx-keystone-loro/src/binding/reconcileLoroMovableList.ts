import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { getModelTypeAndId, getSnapshot, isDataModel, isModel } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import {
  applyDeltaToLoroText,
  convertJsonToLoroData,
  extractTextDeltaFromSnapshot,
} from "./convertJsonToLoroData"
import { isLoroTextModelSnapshot } from "./LoroTextModel"
import { modelIdentityKey, TreapPositionTracker } from "./TreapPositionTracker"

/**
 * Represents a target item from MobX.
 */
type TargetItemInfo =
  | { type: "model"; modelType: string; modelId: string; value: unknown }
  | { type: "primitive"; value: unknown }

/**
 * Reconciles a LoroMovableList to match the order and contents of a MobX array.
 *
 * This function supports mixed arrays containing both:
 * - Models with IDs (uses move-based reconciliation to preserve container identity)
 * - Primitives/nulls/models without IDs (updates in place when possible)
 *
 * The algorithm processes the array position by position:
 * 1. For each target position, determine what should be there
 * 2. If it's a model with ID: move it from its current position (or insert if new)
 * 3. If it's a primitive: update in place if types match, or delete+insert if needed
 * 4. Delete any remaining items at the end
 *
 * Uses ImplicitTreap internally for O(log n) position tracking operations.
 *
 * @param loroList The Loro movable list to reconcile
 * @param mobxArray The MobX array representing the desired state
 */
export function reconcileLoroMovableList(
  loroList: LoroMovableList,
  mobxArray: readonly unknown[]
): void {
  const targetLength = mobxArray.length

  // Build target item infos
  const targets: TargetItemInfo[] = new Array(targetLength)
  const targetModelKeys = new Set<string>()

  for (let i = 0; i < targetLength; i++) {
    const value = mobxArray[i]

    const typeAndId = isModel(value) || isDataModel(value) ? getModelTypeAndId(value) : undefined

    if (typeAndId !== undefined && typeAndId.modelId !== undefined) {
      targets[i] = {
        type: "model",
        modelType: typeAndId.modelType,
        modelId: typeAndId.modelId,
        value,
      }
      targetModelKeys.add(modelIdentityKey(typeAndId.modelType, typeAndId.modelId))
    } else {
      targets[i] = { type: "primitive", value }
    }
  }

  // Build position tracker from current Loro list state
  const tracker = new TreapPositionTracker()
  const indicesToDelete = tracker.initFromLoroList(loroList, targetModelKeys)

  // Delete removed models first (in reverse order)
  for (let i = indicesToDelete.length - 1; i >= 0; i--) {
    loroList.delete(indicesToDelete[i], 1)
  }

  // Update tracker after deletions
  tracker.deleteAtIndices(indicesToDelete)

  // Process each target position
  for (let targetIdx = 0; targetIdx < targetLength; targetIdx++) {
    const target = targets[targetIdx]

    if (target.type === "model") {
      const { modelType, modelId, value } = target
      const currentLoroIdx = tracker.getModelIndex(modelType, modelId)

      if (currentLoroIdx !== undefined) {
        // Model exists in Loro
        if (currentLoroIdx !== targetIdx) {
          // Need to move it
          loroList.move(currentLoroIdx, targetIdx)
          tracker.move(currentLoroIdx, targetIdx)
        }
        // Model is now at targetIdx
      } else {
        // New model - insert it
        insertIntoList(loroList, targetIdx, value)
        tracker.insertModel(targetIdx, modelType, modelId)
      }
    } else {
      // Primitive/null target
      const { value } = target
      const currentLoroLength = loroList.length

      if (targetIdx < currentLoroLength) {
        const loroItem = loroList.get(targetIdx)

        if (loroItem instanceof LoroMap) {
          // There's a model here but we need a primitive
          // Insert primitive before it, which will push the model forward
          insertIntoList(loroList, targetIdx, value)
          tracker.insertPrimitive(targetIdx)
        } else {
          // There's a primitive/null here - check if it matches
          if (loroItem !== value) {
            // Delete and insert new value
            loroList.delete(targetIdx, 1)
            insertIntoList(loroList, targetIdx, value)
            // Tracker: delete old, insert new at same position
            tracker.deleteAt(targetIdx)
            tracker.insertPrimitive(targetIdx)
          }
          // If equal, nothing to do
        }
      } else {
        // Past end of Loro list - just insert
        insertIntoList(loroList, targetIdx, value)
        tracker.insertPrimitive(targetIdx)
      }
    }
  }

  // Delete any remaining items past target length
  while (loroList.length > targetLength) {
    loroList.delete(targetLength, 1)
    tracker.deleteAt(targetLength)
  }
}

/**
 * Inserts a value into a LoroMovableList at the given index.
 * Converts the value to appropriate Loro data structure.
 */
function insertIntoList(list: LoroMovableList, index: number, value: unknown): void {
  const converted = convertValue(value)

  if (
    converted instanceof LoroMap ||
    converted instanceof LoroMovableList ||
    converted instanceof LoroText
  ) {
    list.insertContainer(index, converted)
  } else if (isLoroTextModelSnapshot(converted)) {
    const attachedText = list.insertContainer(index, new LoroText())
    const deltas = extractTextDeltaFromSnapshot((converted as any).deltaList)
    if (deltas.length > 0) {
      applyDeltaToLoroText(attachedText, deltas)
    }
  } else {
    list.insert(index, converted)
  }
}

/**
 * Convert a MobX value to a Loro-compatible value.
 */
function convertValue(v: unknown): unknown {
  if (v === null || v === undefined || typeof v !== "object") {
    return v
  }
  if (Array.isArray(v) && v.length === 0) {
    return new LoroMovableList()
  }
  const sn = getSnapshot(v)
  if (isLoroTextModelSnapshot(sn)) {
    return sn
  }
  return convertJsonToLoroData(sn as PlainValue)
}
