import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { DeepChangeType } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import {
  applyDeltaToLoroText,
  convertJsonToLoroData,
  extractTextDeltaFromSnapshot,
} from "./convertJsonToLoroData"
import type { EnhancedDeepChange } from "./enhanceDeepChange"
import { isLoroTextModelSnapshot } from "./LoroTextModel"
import { resolveLoroPath } from "./resolveLoroPath"

/**
 * Converts a snapshot value (already captured) to a Loro-compatible value.
 * This is used with enhanced changes that have pre-captured snapshots.
 */
function convertSnapshotValue(v: unknown): unknown {
  // Handle primitives directly
  if (v === null || v === undefined || typeof v !== "object") {
    return v
  }
  // Handle plain arrays - used for empty array init
  if (Array.isArray(v) && v.length === 0) {
    return new LoroMovableList()
  }
  // Handle LoroTextModel snapshot specially - we need to return it as-is
  // so the caller can handle creating the LoroText container properly
  if (isLoroTextModelSnapshot(v)) {
    return v
  }
  return convertJsonToLoroData(v as PlainValue)
}

/**
 * Inserts a value into a LoroMovableList at the given index.
 */
function insertIntoList(list: LoroMovableList, index: number, value: unknown): void {
  if (value instanceof LoroMap || value instanceof LoroMovableList || value instanceof LoroText) {
    list.insertContainer(index, value)
  } else if (isLoroTextModelSnapshot(value)) {
    const attachedText = list.insertContainer(index, new LoroText())
    const deltas = extractTextDeltaFromSnapshot((value as any).deltaList)
    if (deltas.length > 0) {
      applyDeltaToLoroText(attachedText, deltas)
    }
  } else {
    list.insert(index, value)
  }
}

/**
 * Sets a value in a LoroMap at the given key.
 */
function setInMap(map: LoroMap, key: string, value: unknown): void {
  if (value === undefined) {
    map.delete(key)
  } else if (
    value instanceof LoroMap ||
    value instanceof LoroMovableList ||
    value instanceof LoroText
  ) {
    map.setContainer(key, value)
  } else if (isLoroTextModelSnapshot(value)) {
    const attachedText = map.setContainer(key, new LoroText())
    const deltas = extractTextDeltaFromSnapshot((value as any).deltaList)
    if (deltas.length > 0) {
      applyDeltaToLoroText(attachedText, deltas)
    }
  } else {
    map.set(key, value)
  }
}

/**
 * Applies an enhanced MobX change to a Loro object.
 * Enhanced changes contain pre-captured snapshots, so we don't need to call getSnapshot()
 * on live references (which could give incorrect results if the object was mutated).
 */
export function applyMobxChangeToLoroObject(
  change: EnhancedDeepChange,
  loroObject: BindableLoroContainer
): void {
  const loroContainer = resolveLoroPath(loroObject, change.path)

  // If container doesn't exist at this path, throw an error
  if (!loroContainer) {
    throw failure(
      `cannot apply change to missing Loro container at path: ${JSON.stringify(change.path)}`
    )
  }

  if (loroContainer instanceof LoroMovableList) {
    if (change.type === DeepChangeType.ArraySplice) {
      if (change.removedValues.length > 0) {
        loroContainer.delete(change.index, change.removedValues.length)
      }
      if (change.addedSnapshots.length > 0) {
        const valuesToInsert = change.addedSnapshots.map(convertSnapshotValue)
        for (let i = 0; i < valuesToInsert.length; i++) {
          insertIntoList(loroContainer, change.index + i, valuesToInsert[i])
        }
      }
    } else if (change.type === DeepChangeType.ArrayUpdate) {
      const converted = convertSnapshotValue(change.newValueSnapshot)
      if (
        converted instanceof LoroMap ||
        converted instanceof LoroMovableList ||
        converted instanceof LoroText
      ) {
        loroContainer.setContainer(change.index, converted)
      } else if (isLoroTextModelSnapshot(converted)) {
        const attachedText = loroContainer.setContainer(change.index, new LoroText())
        const deltas = extractTextDeltaFromSnapshot((converted as any).deltaList)
        if (deltas.length > 0) {
          applyDeltaToLoroText(attachedText, deltas)
        }
      } else {
        loroContainer.set(change.index, converted)
      }
    } else {
      throw failure(`unsupported array change type: ${change.type}`)
    }
  } else if (loroContainer instanceof LoroMap) {
    if (change.type === DeepChangeType.ObjectAdd || change.type === DeepChangeType.ObjectUpdate) {
      const key = change.key
      const converted = convertSnapshotValue(change.newValueSnapshot)
      setInMap(loroContainer, key, converted)
    } else if (change.type === DeepChangeType.ObjectRemove) {
      const key = change.key
      loroContainer.delete(key)
    } else {
      throw failure(`unsupported object change type: ${change.type}`)
    }
  } else if (loroContainer instanceof LoroText) {
    // Handle changes to LoroText properties (mainly deltaList)
    if (change.type === DeepChangeType.ObjectAdd || change.type === DeepChangeType.ObjectUpdate) {
      const key = change.key
      if (key === "deltaList") {
        // Apply deltas to the LoroText - use the pre-captured snapshot
        const deltas = extractTextDeltaFromSnapshot(change.newValueSnapshot)
        // Clear existing text first
        if (loroContainer.length > 0) {
          loroContainer.delete(0, loroContainer.length)
        }
        // Apply new delta if not empty
        if (deltas.length > 0) {
          applyDeltaToLoroText(loroContainer, deltas)
        }
      }
      // ignore other property changes on LoroText as they're not synced
    } else if (change.type === DeepChangeType.ObjectRemove) {
      // ignore removes on LoroText properties
    } else {
      throw failure(`unsupported LoroText change type: ${change.type}`)
    }
  } else {
    throw failure(`unsupported Loro container type: ${loroContainer}`)
  }
}
