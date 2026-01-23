import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { DeepChange, DeepChangeType } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import {
  applyDeltaToLoroText,
  convertJsonToLoroData,
  extractTextDeltaFromSnapshot,
} from "./convertJsonToLoroData"
import { isLoroTextModelSnapshot } from "./LoroTextModel"
import type { ArrayMoveChange } from "./moveWithinArray"
import { resolveLoroPath } from "./resolveLoroPath"

/**
 * Converts a snapshot value to a Loro-compatible value.
 * Note: All values passed here are already snapshots (captured at change time).
 */
function convertValue(v: unknown): unknown {
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
  // Value is already a snapshot, convert to Loro data
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
 * Applies a MobX DeepChange or an ArrayMoveChange to a Loro object.
 */
export function applyMobxChangeToLoroObject(
  change: DeepChange | ArrayMoveChange,
  loroObject: BindableLoroContainer
): void {
  const loroContainer = resolveLoroPath(loroObject, change.path)

  // If container doesn't exist at this path, throw an error
  if (!loroContainer) {
    throw failure(
      `cannot apply change to missing Loro container at path: ${JSON.stringify(change.path)}`
    )
  }

  switch (change.type) {
    case "ArrayMove": {
      if (!(loroContainer instanceof LoroMovableList)) {
        throw failure(`ArrayMove change requires a LoroMovableList container`)
      }
      loroContainer.move(change.fromIndex, change.toIndex)
      break
    }

    case DeepChangeType.ArraySplice: {
      if (!(loroContainer instanceof LoroMovableList)) {
        throw failure(`ArraySplice change requires a LoroMovableList container`)
      }
      if (change.removedValues.length > 0) {
        loroContainer.delete(change.index, change.removedValues.length)
      }
      if (change.addedValues.length > 0) {
        const valuesToInsert = change.addedValues.map(convertValue)
        for (let i = 0; i < valuesToInsert.length; i++) {
          insertIntoList(loroContainer, change.index + i, valuesToInsert[i])
        }
      }
      break
    }

    case DeepChangeType.ArrayUpdate: {
      if (!(loroContainer instanceof LoroMovableList)) {
        throw failure(`ArrayUpdate change requires a LoroMovableList container`)
      }
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
      break
    }

    case DeepChangeType.ObjectAdd:
    case DeepChangeType.ObjectUpdate: {
      if (loroContainer instanceof LoroText) {
        // Handle changes to LoroText properties (mainly deltaList)
        if (change.key === "deltaList") {
          // change.newValue is already a snapshot (captured at change time)
          const deltas = extractTextDeltaFromSnapshot(change.newValue)
          if (loroContainer.length > 0) {
            loroContainer.delete(0, loroContainer.length)
          }
          if (deltas.length > 0) {
            applyDeltaToLoroText(loroContainer, deltas)
          }
        }
        // ignore other property changes on LoroText as they're not synced
      } else if (loroContainer instanceof LoroMap) {
        const converted = convertValue(change.newValue)
        setInMap(loroContainer, change.key, converted)
      } else {
        throw failure(`ObjectAdd/ObjectUpdate change requires a LoroMap or LoroText container`)
      }
      break
    }

    case DeepChangeType.ObjectRemove: {
      if (loroContainer instanceof LoroText) {
        // ignore removes on LoroText properties
      } else if (loroContainer instanceof LoroMap) {
        loroContainer.delete(change.key)
      } else {
        throw failure(`ObjectRemove change requires a LoroMap or LoroText container`)
      }
      break
    }

    default: {
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustiveCheck: never = change
      throw failure(`unsupported change type: ${(_exhaustiveCheck as any).type}`)
    }
  }
}
