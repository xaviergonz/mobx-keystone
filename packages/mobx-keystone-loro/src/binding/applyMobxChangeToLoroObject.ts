import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { type DeepChange, DeepChangeType } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import {
  insertLoroListValue,
  setLoroListValue,
  setLoroMapValue,
} from "../utils/loroContainerWrites"
import {
  convertJsonToLoroData,
  extractTextDeltaFromSnapshot,
  replaceLoroTextDelta,
} from "./convertJsonToLoroData"
import type { ArrayMoveChange } from "./moveWithinArray"
import { resolveLoroPath } from "./resolveLoroPath"

/**
 * Converts a snapshot value to a Loro-compatible value.
 * Note: All values passed here are already snapshots (captured at change time).
 */
function convertValue(v: unknown): unknown {
  return convertJsonToLoroData(v as PlainValue)
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
      if (change.addedValues.includes(undefined)) {
        throw failure("undefined values are not supported in Loro lists")
      }
      const valuesToInsert = change.addedValues.map(convertValue)
      if (change.removedValues.length > 0) {
        loroContainer.delete(change.index, change.removedValues.length)
      }
      for (let i = 0; i < valuesToInsert.length; i++) {
        insertLoroListValue(loroContainer, change.index + i, valuesToInsert[i])
      }
      break
    }

    case DeepChangeType.ArrayUpdate: {
      if (!(loroContainer instanceof LoroMovableList)) {
        throw failure(`ArrayUpdate change requires a LoroMovableList container`)
      }
      if (change.newValue === undefined) {
        throw failure("undefined values are not supported in Loro lists")
      }
      setLoroListValue(loroContainer, change.index, convertValue(change.newValue))
      break
    }

    case DeepChangeType.ObjectAdd:
    case DeepChangeType.ObjectUpdate: {
      if (loroContainer instanceof LoroText) {
        // Handle changes to LoroText properties (mainly deltaList)
        if (change.key === "deltaList") {
          // change.newValue is already a snapshot (captured at change time)
          replaceLoroTextDelta(loroContainer, extractTextDeltaFromSnapshot(change.newValue))
        }
        // ignore other property changes on LoroText as they're not synced
      } else if (loroContainer instanceof LoroMap) {
        if (change.newValue === undefined) loroContainer.delete(change.key)
        else setLoroMapValue(loroContainer, change.key, convertValue(change.newValue))
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
