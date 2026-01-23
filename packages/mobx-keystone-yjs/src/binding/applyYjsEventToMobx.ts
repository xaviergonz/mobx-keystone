import { remove } from "mobx"
import {
  Frozen,
  fromSnapshot,
  frozen,
  getSnapshot,
  getSnapshotModelId,
  isFrozenSnapshot,
  isModel,
  Path,
  resolvePath,
  runUnprotected,
} from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { convertYjsDataToJson } from "./convertYjsDataToJson"

// Represents the map of potential objects to reconcile (ID -> Object)
export type ReconciliationMap = Map<string, object>

/**
 * Applies a Y.js event directly to the MobX model tree using proper mutations
 * (splice for arrays, property assignment for objects).
 * This is more efficient than converting to patches first.
 */
export function applyYjsEventToMobx(
  event: Y.YEvent<any>,
  boundObject: object,
  reconciliationMap: ReconciliationMap
): void {
  const path = event.path as Path
  const { value: target } = resolvePath(boundObject, path)

  if (!target) {
    throw failure(`cannot resolve path ${JSON.stringify(path)}`)
  }

  // Wrap in runUnprotected since we're modifying the tree from outside a model action
  runUnprotected(() => {
    if (event instanceof Y.YMapEvent) {
      applyYMapEventToMobx(event, target, reconciliationMap)
    } else if (event instanceof Y.YArrayEvent) {
      applyYArrayEventToMobx(event, target, reconciliationMap)
    } else if (event instanceof Y.YTextEvent) {
      applyYTextEventToMobx(event, target)
    }
  })
}

function processDeletedValue(val: unknown, reconciliationMap: ReconciliationMap) {
  if (val && typeof val === "object" && isModel(val)) {
    const sn = getSnapshot(val)
    const id = getSnapshotModelId(sn)
    if (id) {
      reconciliationMap.set(id, val)
    }
  }
}

function reviveValue(jsonValue: any, reconciliationMap: ReconciliationMap): any {
  // Handle primitives
  if (jsonValue === null || typeof jsonValue !== "object") {
    return jsonValue
  }

  // Handle frozen
  if (isFrozenSnapshot(jsonValue)) {
    return frozen(jsonValue.data)
  }

  // If we have a reconciliation map and the value looks like a model with an ID, check if we have it
  if (reconciliationMap && jsonValue && typeof jsonValue === "object") {
    const modelId = getSnapshotModelId(jsonValue)
    if (modelId) {
      const existing = reconciliationMap.get(modelId)
      if (existing) {
        reconciliationMap.delete(modelId)
        return existing
      }
    }
  }

  return fromSnapshot(jsonValue)
}

function applyYMapEventToMobx(
  event: Y.YMapEvent<any>,
  target: Record<string, any>,
  reconciliationMap: ReconciliationMap
): void {
  const source = event.target

  event.changes.keys.forEach((change, key) => {
    switch (change.action) {
      case "add":
      case "update": {
        const yjsValue = source.get(key)
        const jsonValue = convertYjsDataToJson(yjsValue)

        // If updating, the old value is overwritten (deleted conceptually)
        if (change.action === "update") {
          processDeletedValue(target[key], reconciliationMap)
        }

        target[key] = reviveValue(jsonValue, reconciliationMap)
        break
      }

      case "delete": {
        processDeletedValue(target[key], reconciliationMap)
        // Use MobX's remove to properly delete the key from the observable object
        // This triggers the "remove" interceptor in mobx-keystone's tweaker
        if (isModel(target)) {
          remove(target.$, key)
        } else {
          remove(target, key)
        }
        break
      }

      default:
        throw failure(`unsupported Yjs map event action: ${change.action}`)
    }
  })
}

function applyYArrayEventToMobx(
  event: Y.YArrayEvent<any>,
  target: any[],
  reconciliationMap: ReconciliationMap
): void {
  // Process delta operations in order
  let currentIndex = 0

  for (const change of event.changes.delta) {
    if (change.retain) {
      currentIndex += change.retain
    }

    if (change.delete) {
      // Capture deleted items for reconciliation
      const deletedItems = target.slice(currentIndex, currentIndex + change.delete)
      deletedItems.forEach((item) => {
        processDeletedValue(item, reconciliationMap)
      })

      // Delete items at current position
      target.splice(currentIndex, change.delete)
    }

    if (change.insert) {
      // Insert items at current position
      const insertedItems = Array.isArray(change.insert) ? change.insert : [change.insert]
      const values = insertedItems.map((yjsValue) => {
        const jsonValue = convertYjsDataToJson(yjsValue)
        return reviveValue(jsonValue, reconciliationMap)
      })

      target.splice(currentIndex, 0, ...values)
      currentIndex += values.length
    }
  }
}

function applyYTextEventToMobx(
  event: Y.YTextEvent,
  target: { deltaList?: Frozen<unknown[]>[] }
): void {
  // YjsTextModel handles text events by appending delta to deltaList
  if (target?.deltaList) {
    target.deltaList.push(frozen(event.delta))
  }
}
