import type { ContainerID, ListDiff, LoroDoc, LoroEvent, MapDiff } from "loro-crdt"
import { isContainer, LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { remove } from "mobx"
import {
  Frozen,
  fromSnapshot,
  frozen,
  getSnapshotModelId,
  isDataModel,
  isFrozenSnapshot,
  isModel,
  modelIdKey,
  Path,
  resolvePath,
  runUnprotected,
} from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import { convertLoroDataToJson } from "./convertLoroDataToJson"

// Represents the map of potential objects to reconcile (ID -> Object)
export type ReconciliationMap = Map<string, object>

/**
 * Applies a Loro event directly to the MobX model tree using proper mutations
 * (splice for arrays, property assignment for objects).
 * This is more efficient than converting to patches first.
 */
export function applyLoroEventToMobx(
  event: LoroEvent,
  loroDoc: LoroDoc,
  boundObject: object,
  rootPath: Path,
  reconciliationMap: ReconciliationMap,
  newlyInsertedContainers: Set<ContainerID>
): void {
  // Skip events for containers that were just inserted as part of another container
  // Their content is already included in the parent's convertLoroDataToJson call
  if (newlyInsertedContainers.has(event.target)) {
    return
  }

  // Resolve the path relative to the root
  const eventPath = loroDoc.getPathToContainer(event.target)
  if (!eventPath) {
    return
  }

  // Strip the root path to get relative path
  const relativePath = resolveEventPath(eventPath, rootPath)
  if (relativePath === undefined) {
    return
  }

  const { value: target } = resolvePath(boundObject, relativePath)

  if (!target) {
    throw failure(`cannot resolve path ${JSON.stringify(relativePath)}`)
  }

  // Wrap in runUnprotected since we're modifying the tree from outside a model action
  runUnprotected(() => {
    const diff = event.diff
    if (diff.type === "map") {
      applyMapEventToMobx(diff, loroDoc, event.target, target, reconciliationMap)
    } else if (diff.type === "list") {
      applyListEventToMobx(
        diff,
        loroDoc,
        event.target,
        target,
        reconciliationMap,
        newlyInsertedContainers
      )
    } else if (diff.type === "text") {
      applyTextEventToMobx(loroDoc, event.target, target)
    }
  })
}

function processDeletedValue(val: unknown, reconciliationMap: ReconciliationMap) {
  // Handle both Model and DataModel instances
  if (isModel(val) || isDataModel(val)) {
    const id = modelIdKey in val ? val[modelIdKey] : undefined
    if (id) {
      reconciliationMap.set(id, val)
    }
  }
}

function reviveValue(jsonValue: unknown, reconciliationMap: ReconciliationMap): unknown {
  // Handle primitives
  if (jsonValue === null || typeof jsonValue !== "object") {
    return jsonValue
  }

  // Handle frozen
  if (isFrozenSnapshot(jsonValue)) {
    return frozen(jsonValue.data)
  }

  // If we have a reconciliation map and the value looks like a model with an ID, check if we have it
  if (reconciliationMap) {
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

function applyMapEventToMobx(
  diff: MapDiff,
  loroDoc: LoroDoc,
  containerTarget: ContainerID,
  target: Record<string, unknown>,
  reconciliationMap: ReconciliationMap
): void {
  const container = loroDoc.getContainerById(containerTarget)

  if (!container || !(container instanceof LoroMap)) {
    throw failure(`${containerTarget} was not a Loro map`)
  }

  // Process additions and updates from diff.updated
  for (const key of Object.keys(diff.updated)) {
    const loroValue = container.get(key)

    if (loroValue === undefined) {
      // Key was deleted (Loro returns undefined for deleted keys)
      if (key in target) {
        processDeletedValue(target[key], reconciliationMap)
        // Use MobX's remove to properly delete the key from the observable object
        if (isModel(target)) {
          remove(target.$, key)
        } else {
          remove(target, key)
        }
      }
    } else {
      // Key was added or updated
      if (key in target) {
        processDeletedValue(target[key], reconciliationMap)
      }
      const jsonValue = convertLoroDataToJson(loroValue as PlainValue)
      target[key] = reviveValue(jsonValue, reconciliationMap)
    }
  }
}

function applyListEventToMobx(
  diff: ListDiff,
  loroDoc: LoroDoc,
  containerTarget: ContainerID,
  target: unknown[],
  reconciliationMap: ReconciliationMap,
  newlyInsertedContainers: Set<ContainerID>
): void {
  const container = loroDoc.getContainerById(containerTarget)

  if (!container || !(container instanceof LoroMovableList)) {
    throw failure(`${containerTarget} was not a Loro movable list`)
  }

  // Process delta operations in order
  let currentIndex = 0

  for (const change of diff.diff) {
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
      const insertedItems = change.insert
      const values = insertedItems.map((loroValue) => {
        // Track container IDs to avoid double-processing their events
        // When a container with data is inserted, Loro fires events for both
        // the container insert and the container's content, but the content
        // is already included in convertLoroDataToJson
        if (isContainer(loroValue)) {
          newlyInsertedContainers.add(loroValue.id)
          // Also recursively track any nested containers
          collectNestedContainerIds(loroValue, newlyInsertedContainers)
        }
        const jsonValue = convertLoroDataToJson(loroValue as PlainValue)
        return reviveValue(jsonValue, reconciliationMap)
      })

      target.splice(currentIndex, 0, ...values)
      currentIndex += values.length
    }
  }
}

function applyTextEventToMobx(
  loroDoc: LoroDoc,
  containerTarget: ContainerID,
  target: { deltaList?: Frozen<unknown[]> }
): void {
  const container = loroDoc.getContainerById(containerTarget)

  if (!container || !(container instanceof LoroText)) {
    throw failure(`${containerTarget} was not a Loro text container`)
  }

  // LoroTextModel has deltaList as a single Frozen<LoroTextDeltaList>, not an array
  // Replace it with the current delta from the LoroText
  if (!("deltaList" in target)) {
    throw failure("target does not have a deltaList property - expected LoroTextModel")
  }
  target.deltaList = frozen(container.toDelta())
}

/**
 * Recursively collects all container IDs from a Loro container.
 * This is used to track containers that have been inserted and should not
 * have their events processed again (since their content was already included
 * in the parent's convertLoroDataToJson call).
 */
function collectNestedContainerIds(container: unknown, containerIds: Set<ContainerID>): void {
  if (!isContainer(container)) {
    return
  }

  // Add this container's ID
  containerIds.add(container.id)

  // Handle LoroMap - iterate over values
  if (container instanceof LoroMap) {
    for (const key of Object.keys(container.toJSON())) {
      const value = container.get(key)
      collectNestedContainerIds(value, containerIds)
    }
  }

  // Handle LoroMovableList - iterate over items
  if (container instanceof LoroMovableList) {
    for (let i = 0; i < container.length; i++) {
      collectNestedContainerIds(container.get(i), containerIds)
    }
  }

  // LoroText doesn't contain nested containers
}

/**
 * Resolves the path from a Loro event to a mobx-keystone path.
 * The event path is the path from the doc root to the container that emitted the event.
 * We need to strip the path of our root container to get a path relative to our bound object.
 */
function resolveEventPath(eventPath: Path, rootPath: Path): Path | undefined {
  if (eventPath.length < rootPath.length) {
    return undefined
  }

  for (let i = 0; i < rootPath.length; i++) {
    if (eventPath[i] !== rootPath[i]) {
      return undefined
    }
  }

  return eventPath.slice(rootPath.length) as Path
}
