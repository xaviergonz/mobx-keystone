import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { DeepChange, DeepChangeType, getSnapshot } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import {
  applyDeltaToLoroText,
  convertJsonToLoroData,
  extractTextDeltaFromSnapshot,
} from "./convertJsonToLoroData"
import { isLoroTextModelSnapshot } from "./LoroTextModel"
import { resolveLoroPath } from "./resolveLoroPath"

function convertValue(v: unknown): unknown {
  // Handle primitives directly
  if (v === null || v === undefined || typeof v !== "object") {
    return v
  }
  // Handle plain arrays (not MobX observables) - used for empty array init
  if (Array.isArray(v) && v.length === 0) {
    return new LoroMovableList()
  }
  const sn = getSnapshot(v)
  // Handle LoroTextModel snapshot specially - we need to return it as-is
  // so the caller can handle creating the LoroText container properly
  if (isLoroTextModelSnapshot(sn)) {
    return sn
  }
  return convertJsonToLoroData(sn as PlainValue)
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

export function applyMobxChangeToLoroObject(
  change: DeepChange,
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
      if (change.addedValues.length > 0) {
        const valuesToInsert = change.addedValues.map(convertValue)
        for (let i = 0; i < valuesToInsert.length; i++) {
          insertIntoList(loroContainer, change.index + i, valuesToInsert[i])
        }
      }
    } else if (change.type === DeepChangeType.ArrayUpdate) {
      const converted = convertValue(change.newValue)
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
      const converted = convertValue(change.newValue)
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
        // Apply deltas to the LoroText
        const deltaFieldValue = getSnapshot(change.newValue)
        const deltas = extractTextDeltaFromSnapshot(deltaFieldValue)
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
