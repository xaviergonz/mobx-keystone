import { jsonEquals } from "@mobx-keystone/crdt-binding-common"
import { type IObservableArray, remove, set } from "mobx"
import {
  type AnyModel,
  applySnapshot,
  type Frozen,
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
  ModelAutoTypeCheckingMode,
  type ModelClass,
  modelTypeKey,
  type Path,
  resolvePath,
  runUnprotected,
} from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { applyYjsEventsToSnapshot } from "./applyYjsEventsToSnapshot"
import { convertYjsDataToJsonInternal } from "./convertYjsDataToJson"

function changesModelIdentity(event: Y.YMapEvent<unknown>): boolean {
  const typeChange = event.changes.keys.get(modelTypeKey)
  if (typeChange && !Object.is(typeChange.oldValue, event.target.get(modelTypeKey))) return true
  // The bound root itself cannot be replaced. Nested identities are resolved
  // through their parent, just like changes to the model discriminator.
  if (event.path.length === 0) return false
  const modelType = event.target.get(modelTypeKey)
  if (typeof modelType !== "string") return false
  const modelClass = getModelInfoForName(modelType)?.class
  if (!modelClass || !isModel(modelClass.prototype)) return false
  const idKey = getModelIdPropertyName(modelClass as ModelClass<AnyModel>)
  if (idKey === undefined) return false
  const change = event.changes.keys.get(idKey)
  return change !== undefined && !Object.is(change.oldValue, event.target.get(idKey))
}

/**
 * Apply simple events incrementally. Structural replacements/deletions use the
 * core snapshot reconciler at the common ancestor of the affected paths, so
 * moves are independent of event ordering and model identity is preserved.
 * @internal
 */
export function applyYjsEventsToMobx(events: Y.YEvent<any>[], boundObject: object): boolean {
  // Identity checks are needed both to decide on reconciliation and to pick the
  // reconciled paths below, so resolve each event's model info only once.
  const identityChanges = events.map(
    (event) => event instanceof Y.YMapEvent && changesModelIdentity(event)
  )

  const needsReconciliation = events.some((event, index) => {
    if (event instanceof Y.YArrayEvent) {
      // Only removed shared containers can hold model identities to reconcile.
      // Primitive/frozen deletions should remain a single array splice.
      for (const item of event.changes.deleted) {
        if (item.content instanceof Y.ContentType) {
          return true
        }
      }
      return false
    }
    if (event instanceof Y.YMapEvent) {
      if (identityChanges[index]) {
        return true
      }
      let isModelTarget: boolean | undefined
      for (const [key, change] of event.changes.keys) {
        if (change.action !== "add" && change.oldValue instanceof Y.AbstractType) {
          return true
        }
        if (change.action === "delete" || event.target.get(key) == null) {
          // Only nullish assignments/deletions need model default semantics.
          // Paths use final Yjs indices, so prefer the source discriminator
          // when identifying models that shifted within an array.
          isModelTarget ??=
            event.target.has(modelTypeKey) || isModel(resolvePath(boundObject, event.path).value)
          if (isModelTarget) return true
        }
      }
      return false
    }
    return false
  })

  if (needsReconciliation || events.length > 1) {
    // Identity changes must be reconciled by the parent, which can replace
    // the instance or find the matching model elsewhere in the affected tree.
    const paths = events.map((event, index) =>
      identityChanges[index] ? event.path.slice(0, -1) : event.path
    )
    const path = [...paths[0]]
    for (const eventPath of paths.slice(1)) {
      let length = 0
      while (length < path.length && path[length] === eventPath[length]) {
        length++
      }
      path.length = length
    }
    const { value: target } = resolvePath(boundObject, path)
    // Separate events can jointly satisfy a refinement on their shared ancestor.
    // Validate the completed transaction there, rather than each intermediate
    // container. Untyped trees retain the incremental event path.
    if (needsReconciliation || mayRequireTypeChecking(target)) {
      const snapshot = applyYjsEventsToSnapshot(getSnapshot(target), events, path.length)
      applySnapshot(target, snapshot)
      return !jsonEquals(getSnapshot(target), snapshot)
    }
  }

  let normalizedSnapshot = false
  runUnprotected(() => {
    for (const event of events) {
      const path = event.path as Path
      const { value: target } = resolvePath(boundObject, path)
      if (!target) {
        throw failure(`cannot resolve path ${JSON.stringify(path)}`)
      }
      if (event instanceof Y.YMapEvent) {
        normalizedSnapshot = applyYMapEventToMobx(event, target) || normalizedSnapshot
      } else if (event instanceof Y.YArrayEvent) {
        applyYArrayEventToMobx(event, target)
      } else if (event instanceof Y.YTextEvent) {
        applyYTextEventToMobx(event, target)
      }
    }
  })
  return normalizedSnapshot
}

function reviveValue(jsonValue: any): any {
  if (jsonValue === null || typeof jsonValue !== "object") {
    return jsonValue
  }
  if (isFrozenSnapshot(jsonValue)) {
    return frozen(jsonValue.data)
  }
  return fromSnapshot(jsonValue)
}

function applyYMapEventToMobx(event: Y.YMapEvent<any>, target: Record<string, any>): boolean {
  const source = event.target
  // Incoming values use the stored snapshot representation, not transformed
  // model properties. Resolve the data target once for the whole event.
  const modelTarget = isModel(target)
  const dataTarget = modelTarget ? target.$ : target
  const processor = modelTarget
    ? getModelInfoForName(target[modelTypeKey])?.class.fromSnapshotProcessor
    : undefined
  let changedKeyCount = 1
  if (processor || event.changes.keys.size > 1) {
    changedKeyCount = 0
    for (const [key, change] of event.changes.keys) {
      if (change.action !== "update" || !Object.is(change.oldValue, source.get(key))) {
        if (++changedKeyCount === 2) break
      }
    }
    if (changedKeyCount === 0) return false
  }
  const needsAtomicUpdate = changedKeyCount > 1 && mayRequireTypeChecking(target)
  let incomingSnapshot: Record<string, unknown> | undefined
  if (processor || needsAtomicUpdate) {
    // Multiple writes may violate refinements between assignments. Reconcile
    // their completed snapshot; single writes can remain incremental when
    // processing leaves it unchanged. Retain unrelated snapshot subtrees.
    incomingSnapshot = applyYjsEventsToSnapshot(
      getSnapshot(target),
      [event],
      event.path.length
    ) as Record<string, unknown>
    if (
      needsAtomicUpdate ||
      (processor && !jsonEquals(processor(incomingSnapshot), incomingSnapshot))
    ) {
      applySnapshot(target, incomingSnapshot)
      return !jsonEquals(getSnapshot(target), incomingSnapshot)
    }
  }

  event.changes.keys.forEach((change, key) => {
    switch (change.action) {
      case "add":
      case "update": {
        const yjsValue = source.get(key)
        // Repeated writes need no conversion or assignment. Keep additions
        // distinct: an explicitly added undefined value still creates a key.
        // Discriminators are metadata rather than assignable model fields.
        if (
          Object.is(change.oldValue, yjsValue) &&
          (change.action === "update" || key === modelTypeKey)
        )
          return
        const jsonValue = incomingSnapshot
          ? incomingSnapshot[key]
          : convertYjsDataToJsonInternal(yjsValue)

        const value = reviveValue(jsonValue)
        if (change.action === "add") {
          // New keys must be observable even without MobX proxies.
          set(dataTarget, key, value)
        } else {
          dataTarget[key] = value
        }
        break
      }

      case "delete": {
        // Use MobX's remove to properly delete the key from the observable object
        // This triggers the "remove" interceptor in mobx-keystone's tweaker
        remove(dataTarget, key)
        break
      }

      default:
        throw failure(`unsupported Yjs map event action: ${change.action}`)
    }
  })
  return false
}

function mayRequireTypeChecking(target: object): boolean {
  if (getGlobalConfig().modelAutoTypeChecking === ModelAutoTypeCheckingMode.AlwaysOff) return false
  return (
    (isModel(target) && !!getModelMetadata(target).dataType) ||
    !!findParent(target, (parent) => isModel(parent) && !!getModelMetadata(parent).dataType)
  )
}

function applyYArrayEventToMobx(event: Y.YArrayEvent<any>, target: IObservableArray<any>): void {
  let combineSplices = false
  let hasEdit = false
  let retainedAfterEdit = false
  for (const change of event.changes.delta) {
    if (change.retain && hasEdit) retainedAfterEdit = true
    if (change.insert || change.delete) {
      if (retainedAfterEdit) {
        combineSplices = mayRequireTypeChecking(target)
        break
      }
      hasEdit = true
    }
  }

  let currentIndex = 0
  let deleteCount = 0
  let values: unknown[] = []

  const flushSplice = () => {
    if (values.length === 0) {
      if (deleteCount > 0) target.splice(currentIndex, deleteCount)
    } else {
      // Apply a replacement in one mutation so refinements see its final
      // contents, including when the inserted range is very large.
      target.spliceWithArray(currentIndex, deleteCount, values)
      currentIndex += values.length
    }
    deleteCount = 0
    values = []
  }

  for (const change of event.changes.delta) {
    if (change.retain) {
      if (combineSplices && (deleteCount > 0 || values.length > 0)) {
        // Include retained values between edits in one splice. This preserves
        // their identities and validates only the completed changed range.
        for (let i = 0; i < change.retain; i++) {
          values.push(target[currentIndex + deleteCount + i])
        }
        deleteCount += change.retain
      } else {
        flushSplice()
        currentIndex += change.retain
      }
    }
    deleteCount += change.delete ?? 0
    if (change.insert) {
      const insertedItems = Array.isArray(change.insert) ? change.insert : [change.insert]
      for (const value of insertedItems) {
        values.push(reviveValue(convertYjsDataToJsonInternal(value)))
      }
    }
  }
  flushSplice()
}

function applyYTextEventToMobx(
  event: Y.YTextEvent,
  target: { deltaList?: Frozen<unknown[]>[] }
): void {
  // YjsTextModel handles text events by appending delta to deltaList
  if (target?.deltaList && event.delta.length > 0) {
    target.deltaList.push(frozen(event.delta))
  }
}
