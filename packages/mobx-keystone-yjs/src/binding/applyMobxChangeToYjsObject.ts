import { DeepChange, DeepChangeType, getSnapshot } from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { isYjsValueDeleted } from "../utils/isYjsValueDeleted"
import { convertJsonToYjsData } from "./convertJsonToYjsData"
import { resolveYjsPath } from "./resolveYjsPath"

function convertValue(v: unknown): any {
  // Handle primitives directly
  if (v === null || v === undefined || typeof v !== "object") {
    return v
  }
  // Handle plain arrays (not MobX observables) - used for empty array init
  if (Array.isArray(v) && v.length === 0) {
    return new Y.Array()
  }
  return convertJsonToYjsData(getSnapshot(v) as any)
}

export function applyMobxChangeToYjsObject(
  change: DeepChange,
  yjsObject: Y.Map<any> | Y.Array<any> | Y.Text
): void {
  // Check if the YJS object is deleted
  if (isYjsValueDeleted(yjsObject)) {
    throw failure("cannot apply patch to deleted Yjs value")
  }

  const yjsContainer = resolveYjsPath(yjsObject, change.path)

  if (!yjsContainer) {
    // Container not found, skip this change
    return
  }

  if (yjsContainer instanceof Y.Array) {
    if (change.type === DeepChangeType.ArraySplice) {
      // splice
      yjsContainer.delete(change.index, change.removedValues.length)
      if (change.addedValues.length > 0) {
        const valuesToInsert = change.addedValues.map(convertValue)
        yjsContainer.insert(change.index, valuesToInsert)
      }
    } else if (change.type === DeepChangeType.ArrayUpdate) {
      // update
      yjsContainer.delete(change.index, 1)
      yjsContainer.insert(change.index, [convertValue(change.newValue)])
    } else {
      throw failure(`unsupported array change type: ${change.type}`)
    }
  } else if (yjsContainer instanceof Y.Map) {
    if (change.type === DeepChangeType.ObjectAdd || change.type === DeepChangeType.ObjectUpdate) {
      const key = change.key
      if (change.newValue === undefined) {
        yjsContainer.delete(key)
      } else {
        yjsContainer.set(key, convertValue(change.newValue))
      }
    } else if (change.type === DeepChangeType.ObjectRemove) {
      const key = change.key
      yjsContainer.delete(key)
    } else {
      throw failure(`unsupported object change type: ${change.type}`)
    }
  } else if (yjsContainer instanceof Y.Text) {
    // Y.Text is handled differently - init changes for text are managed by YjsTextModel
    // Skip init changes for Y.Text containers
    return
  } else {
    throw failure(`unsupported Yjs container type: ${yjsContainer}`)
  }
}
