import { jsonEquals } from "@mobx-keystone/crdt-binding-common"
import type { ContainerID, ListDiff, LoroDoc, LoroEvent, MapDiff } from "loro-crdt"
import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { isObservableArray, remove, set } from "mobx"
import {
  type AnyModel,
  applySnapshot,
  Frozen,
  findParent,
  fromSnapshot,
  frozen,
  getGlobalConfig,
  getModelIdPropertyName,
  getModelInfoForName,
  getModelMetadata,
  getSnapshot,
  isFrozenSnapshot,
  isModel,
  isTreeNode,
  ModelAutoTypeCheckingMode,
  type ModelClass,
  modelTypeKey,
  type Path,
  resolvePath,
  runUnprotected,
} from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import { applyLoroEventsToSnapshot } from "./applyLoroEventsToSnapshot"
import { convertLoroDataToJson } from "./convertLoroDataToJson"

/**
 * Reconcile structural changes together so identities can move between paths.
 * @internal
 */
export function applyLoroEventsToMobx(
  events: readonly LoroEvent[],
  doc: LoroDoc,
  boundObject: object,
  rootPath: Path,
  converted: Set<ContainerID>
): { target: object; snapshot: unknown } | undefined {
  // Events outside this binding, and empty diffs, cannot shift any path.
  const candidates = events.flatMap((event) => {
    const absolutePath = doc.getPathToContainer(event.target)
    const path = absolutePath && resolveEventPath(absolutePath, rootPath)
    if (!path) return []
    const diff = event.diff
    if (diff.type === "map" && Object.keys(diff.updated).length === 0) return []
    if (diff.type === "list" && !diff.diff.some((part) => part.delete || part.insert?.length))
      return []
    if (diff.type === "text" && diff.diff.length === 0) return []
    return [{ event, path }]
  })
  const relevant = candidates.filter(({ event, path }) => {
    const diff = event.diff
    if (diff.type !== "map") return true
    // Loro diffs do not contain old values. Compare against MobX only when
    // another event cannot have shifted/replaced this path.
    if (path.length > 0 && candidates.length > 1) return true
    const target = resolvePath(boundObject, path).value
    if (target === undefined) return true
    const data = isModel(target) ? target.$ : target
    const container = doc.getContainerById(event.target) as LoroMap
    return !Object.keys(diff.updated).every((key) => {
      const value = container.get(key)
      const previous = key === modelTypeKey && isModel(target) ? target[modelTypeKey] : data[key]
      if (value === undefined) return previous === undefined && !Object.hasOwn(data, key)
      return (
        Object.is(previous, value) ||
        (isFrozenSnapshot(value) && jsonEquals(getSnapshotValue(previous), value))
      )
    })
  })
  let reconcile = false
  const paths = relevant.map(({ event, path }) => {
    const target = resolvePath(boundObject, path).value
    const diff = event.diff
    if (diff.type === "map") {
      const data = isModel(target) ? target.$ : target
      const container = doc.getContainerById(event.target) as LoroMap
      const modelType = container.get(modelTypeKey)
      const modelClass =
        typeof modelType === "string" ? getModelInfoForName(modelType)?.class : undefined
      // Before parent diffs run, nested event paths may point at another model.
      const stablePath = path.length === 0 || relevant.length === 1
      if (modelClass?.fromSnapshotProcessor) {
        if (stablePath && isModel(target)) {
          // Identity processors (including typed-property processors) do not
          // require full reconciliation for an ordinary scalar update.
          const incoming = applyLoroEventsToSnapshot(
            getSnapshot(target),
            [{ event, path }],
            path.length,
            doc,
            new Set()
          ) as Record<string, unknown>
          if (!jsonEquals(modelClass.fromSnapshotProcessor(incoming), incoming)) reconcile = true
        } else {
          reconcile = true
        }
      }
      const updatedKeys = Object.keys(diff.updated)
      if (updatedKeys.length > 1 && mayRequireTypeChecking(target)) {
        let changedKeys = 0
        for (const key of updatedKeys) {
          if (!Object.is(data?.[key], container.get(key)) && ++changedKeys === 2) {
            reconcile = true
            break
          }
        }
      }
      let changesIdentity = false
      if (Object.hasOwn(diff.updated, modelTypeKey)) {
        const oldType = isModel(target) ? target[modelTypeKey] : undefined
        changesIdentity = target !== undefined && oldType !== modelType
      }
      if (path.length > 0 && modelClass && isModel(modelClass.prototype)) {
        const idKey = getModelIdPropertyName(modelClass as ModelClass<AnyModel>)
        if (idKey !== undefined && Object.hasOwn(diff.updated, idKey)) {
          changesIdentity ||=
            !stablePath || !isModel(target) || !Object.is(target.$[idKey], container.get(idKey))
        }
      }
      if (changesIdentity) {
        if (path.length === 0) throw failure("cannot change the model type of the bound root")
        reconcile = true
        return path.slice(0, -1)
      }
      // Native paths use final list indices. A shifted model may not yet be
      // at that index in MobX, so use its source metadata for default semantics.
      const isModelContainer =
        isModel(target) || (modelClass !== undefined && isModel(modelClass.prototype))
      for (const [key, value] of Object.entries(diff.updated)) {
        const previous = data?.[key]
        if (
          (previous !== null && typeof previous === "object" && !(previous instanceof Frozen)) ||
          (isModelContainer &&
            (value == null || (typeof value === "object" && !isFrozenSnapshot(value))))
        ) {
          reconcile = true
        }
      }
    } else if (diff.type === "list" && (Array.isArray(target) || isObservableArray(target))) {
      let index = 0
      for (const change of diff.diff) {
        index += change.retain ?? 0
        const end = index + (change.delete ?? 0)
        for (; index < end; index++) {
          const value = target[index]
          if (value !== null && typeof value === "object" && !(value instanceof Frozen))
            reconcile = true
        }
      }
    }
    return path
  })
  if (reconcile || relevant.length > 1) {
    const path = [...paths[0]]
    for (const other of paths.slice(1)) {
      let length = 0
      while (length < path.length && path[length] === other[length]) length++
      path.length = length
    }
    const target = resolvePath(boundObject, path).value
    if (reconcile || mayRequireTypeChecking(target)) {
      const snapshot = applyLoroEventsToSnapshot(
        getSnapshot(target),
        relevant,
        path.length,
        doc,
        converted
      )
      applySnapshot(target, snapshot)
      return { target, snapshot }
    }
  }
  for (const { event } of relevant) {
    applyLoroEventToMobx(event, doc, boundObject, rootPath, converted)
  }
  return undefined
}

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
      if (Object.hasOwn(diff.updated, modelTypeKey)) {
        const container = loroDoc.getContainerById(event.target)
        if (!(container instanceof LoroMap)) {
          throw failure(`${event.target} was not a Loro map`)
        }
        const currentType = isModel(target) ? target[modelTypeKey] : undefined
        if (currentType !== container.get(modelTypeKey)) {
          if (relativePath.length === 0) {
            throw failure("cannot change the model type of the bound root")
          }
          // Assigning metadata cannot change a model's class. Revive a new
          // subtree rather than applying a plain-object snapshot to an old model.
          const { value: parent } = resolvePath(boundObject, relativePath.slice(0, -1))
          const snapshot = convertLoroDataToJson(container, newlyInsertedContainers)
          set(
            isModel(parent) ? parent.$ : parent,
            relativePath[relativePath.length - 1],
            fromSnapshot<unknown>(snapshot)
          )
          return
        }
      }
      applyMapEventToMobx(diff, loroDoc, event.target, target, newlyInsertedContainers)
    } else if (diff.type === "list") {
      applyListEventToMobx(diff, loroDoc, event.target, target, newlyInsertedContainers)
    } else if (diff.type === "text") {
      applyTextEventToMobx(loroDoc, event.target, target)
    }
  })
}

function getSnapshotValue(value: unknown): unknown {
  return isTreeNode(value) ? getSnapshot(value) : value
}

function reviveValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  return isFrozenSnapshot(value) ? frozen(value.data) : fromSnapshot(value)
}

function applyMapEventToMobx(
  diff: MapDiff,
  loroDoc: LoroDoc,
  containerTarget: ContainerID,
  target: Record<string, unknown>,
  newlyInsertedContainers: Set<ContainerID>
): void {
  const container = loroDoc.getContainerById(containerTarget)
  if (!(container instanceof LoroMap)) throw failure(`${containerTarget} was not a Loro map`)
  const data = isModel(target) ? target.$ : target
  for (const key of Object.keys(diff.updated)) {
    // Model discriminators are metadata, not assignable data properties.
    if (key === modelTypeKey && isModel(target)) continue
    const value = container.get(key)
    if (value === undefined) {
      remove(data, key)
    } else {
      const snapshot = convertLoroDataToJson(value as PlainValue, newlyInsertedContainers)
      if (jsonEquals(getSnapshotValue(data[key]), snapshot)) continue
      // Stored values bypass property transforms; set also makes new keys
      // observable when MobX proxies are disabled.
      set(data, key, reviveValue(snapshot))
    }
  }
}

function mayRequireTypeChecking(target: object): boolean {
  if (
    getGlobalConfig().modelAutoTypeChecking === ModelAutoTypeCheckingMode.AlwaysOff ||
    !isTreeNode(target)
  )
    return false
  return (
    (isModel(target) && !!getModelMetadata(target).dataType) ||
    !!findParent(target, (parent) => isModel(parent) && !!getModelMetadata(parent).dataType)
  )
}

function applyListEventToMobx(
  diff: ListDiff,
  loroDoc: LoroDoc,
  containerTarget: ContainerID,
  target: unknown[],
  newlyInsertedContainers: Set<ContainerID>
): void {
  if (!(loroDoc.getContainerById(containerTarget) instanceof LoroMovableList)) {
    throw failure(`${containerTarget} was not a Loro movable list`)
  }
  // Structural deletions are reconciled by applyLoroEventsToMobx. Combine
  // adjacent primitive replacements so refinements never see a temporary length.
  let combineSplices = false
  let hasEdit = false
  let retainedAfterEdit = false
  for (const change of diff.diff) {
    if (change.retain && hasEdit) retainedAfterEdit = true
    if (change.insert?.length || change.delete) {
      if (retainedAfterEdit) {
        combineSplices = mayRequireTypeChecking(target)
        break
      }
      hasEdit = true
    }
  }
  let index = 0
  let deleteCount = 0
  let values: unknown[] = []
  const flush = () => {
    if (values.length === 0) {
      if (deleteCount) target.splice(index, deleteCount)
    } else if (isObservableArray(target)) {
      // One mutation lets automatic checks see the complete replacement.
      target.spliceWithArray(index, deleteCount, values)
      index += values.length
    } else {
      // Plain arrays have no automatic checks; avoid native argument limits.
      const batchSize = 8192
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize)
        const removed =
          i + batch.length === values.length ? deleteCount : Math.min(deleteCount, batch.length)
        target.splice(index, removed, ...batch)
        deleteCount -= removed
        index += batch.length
      }
    }
    deleteCount = 0
    values = []
  }
  for (const change of diff.diff) {
    if (change.retain) {
      if (combineSplices && (deleteCount > 0 || values.length > 0)) {
        for (let i = 0; i < change.retain; i++) values.push(target[index + deleteCount + i])
        deleteCount += change.retain
      } else {
        flush()
        index += change.retain
      }
    }
    deleteCount += change.delete ?? 0
    for (const value of change.insert ?? []) {
      values.push(reviveValue(convertLoroDataToJson(value as PlainValue, newlyInsertedContainers)))
    }
  }
  flush()
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
