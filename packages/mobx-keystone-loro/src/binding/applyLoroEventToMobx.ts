import {
  applyListDeltaToArray,
  commonPathPrefix,
  getSnapshotValue,
  jsonEquals,
  mayRequireTypeChecking,
  reviveValue,
} from "@mobx-keystone/crdt-binding-common"
import type { ContainerID, LoroDoc, LoroEvent, MapDiff } from "loro-crdt"
import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { type IObservableArray, isObservableArray, remove, set } from "mobx"
import {
  type AnyModel,
  applySnapshot,
  Frozen,
  fromSnapshot,
  frozen,
  getModelIdPropertyName,
  getModelInfoForName,
  getSnapshot,
  isFrozenSnapshot,
  isModel,
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
      // Once reconciling, skip the processor check: it reads a whole snapshot.
      if (!reconcile && modelClass?.fromSnapshotProcessor) {
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
      if (!reconcile && updatedKeys.length > 1 && mayRequireTypeChecking(target)) {
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
      reconcile ||= Object.entries(diff.updated).some(([key, value]) => {
        const previous = data?.[key]
        return (
          (previous !== null && typeof previous === "object" && !(previous instanceof Frozen)) ||
          (isModelContainer &&
            (value == null || (typeof value === "object" && !isFrozenSnapshot(value))))
        )
      })
    } else if (
      !reconcile &&
      diff.type === "list" &&
      (Array.isArray(target) || isObservableArray(target))
    ) {
      let index = 0
      for (const change of diff.diff) {
        index += change.retain ?? 0
        const end = index + (change.delete ?? 0)
        for (; index < end && !reconcile; index++) {
          const value = target[index]
          reconcile = value !== null && typeof value === "object" && !(value instanceof Frozen)
        }
        if (reconcile) break
      }
    }
    return path
  })
  if (reconcile || relevant.length > 1) {
    const path = commonPathPrefix(paths)!
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
  for (const { event, path } of relevant) {
    applyLoroEventToMobx(event, path, doc, boundObject, converted)
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
  relativePath: Path,
  loroDoc: LoroDoc,
  boundObject: object,
  newlyInsertedContainers: Set<ContainerID>
): void {
  // Skip events for containers that were just inserted as part of another container
  // Their content is already included in the parent's convertLoroDataToJson call
  if (newlyInsertedContainers.has(event.target)) {
    return
  }

  const { value: target } = resolvePath(boundObject, relativePath)

  if (!target) {
    throw failure(`cannot resolve path ${JSON.stringify(relativePath)}`)
  }

  // Wrap in runUnprotected since we're modifying the tree from outside a model action
  runUnprotected(() => {
    const diff = event.diff
    const container = loroDoc.getContainerById(event.target)
    if (diff.type === "map") {
      if (!(container instanceof LoroMap)) {
        throw failure(`${event.target} was not a Loro map`)
      }
      if (Object.hasOwn(diff.updated, modelTypeKey)) {
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
      applyMapEventToMobx(diff, container, target, newlyInsertedContainers)
    } else if (diff.type === "list") {
      if (!(container instanceof LoroMovableList)) {
        throw failure(`${event.target} was not a Loro movable list`)
      }
      // Structural deletions are reconciled by applyLoroEventsToMobx.
      applyListDeltaToArray(target as IObservableArray<unknown>, diff.diff, (value) =>
        reviveValue(convertLoroDataToJson(value as PlainValue, newlyInsertedContainers))
      )
    } else if (diff.type === "text") {
      if (!(container instanceof LoroText)) {
        throw failure(`${event.target} was not a Loro text container`)
      }
      // LoroTextModel stores the current delta rather than a history of edits.
      if (!("deltaList" in target)) {
        throw failure("target does not have a deltaList property - expected LoroTextModel")
      }
      target.deltaList = frozen(container.toDelta())
    }
  })
}

function applyMapEventToMobx(
  diff: MapDiff,
  container: LoroMap,
  target: Record<string, unknown>,
  newlyInsertedContainers: Set<ContainerID>
): void {
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
