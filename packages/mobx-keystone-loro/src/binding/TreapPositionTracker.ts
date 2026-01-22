import { LoroMap, LoroMovableList } from "loro-crdt"
import {
  AnyModel,
  getModelIdPropertyName,
  getModelInfoForName,
  ModelClass,
  modelTypeKey,
} from "mobx-keystone"
import { ImplicitTreap } from "./ImplicitTreap"

type TrackedItem =
  | { type: "model"; modelType: string; modelId: string }
  | { type: "primitive"; slotId: number }

export function modelIdentityKey(modelType: string, modelId: string): string {
  // Using a separator that cannot appear in JS strings produced by JSON.
  return modelType + "\0" + modelId
}

function getLoroMapModelIdentity(
  loroMap: LoroMap
): { modelType: string; modelId: string } | undefined {
  const modelType = loroMap.get(modelTypeKey)
  if (typeof modelType !== "string") {
    return undefined
  }

  const modelInfo = getModelInfoForName(modelType)
  if (!modelInfo) {
    return undefined
  }

  const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)
  if (!modelIdPropertyName) {
    return undefined
  }

  const modelId = loroMap.get(modelIdPropertyName)
  if (typeof modelId !== "string") {
    return undefined
  }

  return { modelType, modelId }
}

/**
 * A position tracker for items in an array using an ImplicitTreap.
 * Provides O(log n) operations for indexOf, move, insert, and delete.
 *
 * This tracker maintains positions for ALL items in the array:
 * - Models are tracked by their stable identity (model type + id)
 * - Primitives are tracked by a unique slot ID (since they have no stable identity)
 */
export class TreapPositionTracker {
  private treap: ImplicitTreap<TrackedItem>
  private modelKeyToItem: Map<string, TrackedItem>
  private nextSlotId = 0

  constructor() {
    this.treap = ImplicitTreap.fromArray([])
    this.modelKeyToItem = new Map()
  }

  /**
   * Initialize the tracker from the current Loro list state.
   * @param loroList The Loro list
   * @param targetModelKeys Set of model identity keys that should be kept (for deletion detection)
   * @returns Array of indices to delete (models no longer in target)
   */
  initFromLoroList(loroList: LoroMovableList, targetModelKeys: Set<string>): number[] {
    const items: TrackedItem[] = []
    const indicesToDelete: number[] = []

    for (let i = 0; i < loroList.length; i++) {
      const loroItem = loroList.get(i)

      if (loroItem instanceof LoroMap) {
        const modelIdentity = getLoroMapModelIdentity(loroItem)
        if (modelIdentity !== undefined) {
          const key = modelIdentityKey(modelIdentity.modelType, modelIdentity.modelId)

          if (targetModelKeys.has(key)) {
            const item: TrackedItem = {
              type: "model",
              modelType: modelIdentity.modelType,
              modelId: modelIdentity.modelId,
            }
            items.push(item)
            this.modelKeyToItem.set(key, item)
          } else {
            // Model no longer in target - mark for deletion
            indicesToDelete.push(i)
            // Still need a placeholder for now (will be deleted)
            items.push({ type: "primitive", slotId: this.nextSlotId++ })
          }
        } else {
          // LoroMap without model ID - treat as primitive
          items.push({ type: "primitive", slotId: this.nextSlotId++ })
        }
      } else {
        // Primitive value
        items.push({ type: "primitive", slotId: this.nextSlotId++ })
      }
    }

    this.treap = ImplicitTreap.fromArray(items)
    return indicesToDelete
  }

  /**
   * Get the current index of a model by its identity (type + id).
   * Returns undefined if the model is not in the tracker.
   * O(log n)
   */
  getModelIndex(modelType: string, modelId: string): number | undefined {
    const item = this.modelKeyToItem.get(modelIdentityKey(modelType, modelId))
    if (!item) return undefined
    const index = this.treap.indexOf(item)
    return index === -1 ? undefined : index
  }

  /**
   * Move an item from one position to another.
   * O(log n)
   */
  move(from: number, to: number): void {
    this.treap.move(from, to)
  }

  /**
   * Insert a new model at a specific index.
   * O(log n)
   */
  insertModel(index: number, modelType: string, modelId: string): void {
    const item: TrackedItem = { type: "model", modelType, modelId }
    this.modelKeyToItem.set(modelIdentityKey(modelType, modelId), item)
    this.treap.insert(index, item)
  }

  /**
   * Insert a new primitive at a specific index.
   * O(log n)
   */
  insertPrimitive(index: number): void {
    const item: TrackedItem = { type: "primitive", slotId: this.nextSlotId++ }
    this.treap.insert(index, item)
  }

  /**
   * Delete item at a specific index.
   * O(log n)
   */
  deleteAt(index: number): void {
    const item = this.treap.get(index)
    if (item?.type === "model") {
      this.modelKeyToItem.delete(modelIdentityKey(item.modelType, item.modelId))
    }
    this.treap.deleteAt(index)
  }

  /**
   * Delete items at multiple indices.
   * Indices must be in ascending order.
   * O(k * log n) where k is the number of deletions
   */
  deleteAtIndices(indices: number[]): void {
    // Delete in reverse order to maintain index validity
    for (let i = indices.length - 1; i >= 0; i--) {
      this.deleteAt(indices[i])
    }
  }

  /**
   * Get the current length of the tracked array.
   * O(1)
   */
  get length(): number {
    return this.treap.length
  }
}
