import {
  captureChangeSnapshots,
  jsonEquals,
  mergeSnapshotChanges,
} from "@mobx-keystone/crdt-binding-common"
import {
  type ContainerID,
  type LoroDoc,
  type LoroEventBatch,
  LoroMap,
  LoroMovableList,
  LoroText,
} from "loro-crdt"
import { action } from "mobx"
import {
  type AnyDataModel,
  type AnyModel,
  type AnyStandardType,
  applySnapshot,
  type DeepChange,
  DeepChangeType,
  fromSnapshot,
  getParentToChildPath,
  getSnapshot,
  isTreeNode,
  type ModelClass,
  onDeepChange,
  onGlobalDeepChange,
  onSnapshot,
  resolvePath,
  type SnapshotInOf,
  type TypeToData,
  type TypeToSnapshotIn,
} from "mobx-keystone"
import { nanoid } from "nanoid"
import type { PlainArray, PlainObject } from "../plainTypes"
import { failure } from "../utils/error"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import { reportLoroEventsChanged } from "../utils/loroCollectionAtoms"
import { applyArrayMoveToSnapshot } from "./applyArrayMoveToSnapshot"
import { applyLoroEventsToMobx } from "./applyLoroEventToMobx"
import { applyMobxChangeToLoroObject } from "./applyMobxChangeToLoroObject"
import {
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  extractTextDeltaFromSnapshot,
  replaceLoroTextDelta,
} from "./convertJsonToLoroData"
import { convertLoroDataToJson } from "./convertLoroDataToJson"
import { hasPendingLoroConflict, type PendingLoroConflictCache } from "./hasPendingLoroConflict"
import { LoroTextModel, loroTextModelId } from "./LoroTextModel"
import { type LoroBindingContext, loroBindingContext } from "./loroBindingContext"
import { type ArrayMoveChange, isChangeForMove, processChangeForMove } from "./moveWithinArray"
import { reconcileLoroModelOrder } from "./reconcileLoroModelOrder"
import { resolveLoroPath } from "./resolveLoroPath"

/**
 * Creates a bidirectional binding between a Loro data structure and a mobx-keystone model.
 */
export function bindLoroToMobxKeystone<
  TType extends AnyStandardType | ModelClass<AnyModel> | ModelClass<AnyDataModel>,
>({
  loroDoc,
  loroObject,
  mobxKeystoneType,
}: {
  /**
   * The Loro document.
   */
  loroDoc: LoroDoc
  /**
   * The bound Loro data structure.
   */
  loroObject: BindableLoroContainer
  /**
   * The mobx-keystone model type.
   */
  mobxKeystoneType: TType
}): {
  /**
   * The bound mobx-keystone instance.
   */
  boundObject: TypeToData<TType>
  /**
   * Disposes the binding.
   */
  dispose: () => void
  /**
   * The Loro origin string used for binding transactions.
   */
  loroOrigin: string
} {
  if (!loroObject.isAttached() || !loroDoc.getPathToContainer(loroObject.id)) {
    throw failure("binding requires an attached, reachable Loro container")
  }

  const loroOrigin = `bindLoroToMobxKeystoneTransactionOrigin-${nanoid()}`

  let applyingLoroChangesToMobxKeystone = 0
  let reconcileBindingCommit = false
  let disposed = false

  const bindingContext: LoroBindingContext = {
    loroDoc,
    loroObject,
    mobxKeystoneType,
    loroOrigin,
    boundObject: undefined, // not yet created

    get isApplyingLoroChangesToMobxKeystone() {
      return applyingLoroChangesToMobxKeystone > 0
    },
  }

  const loroJson = convertLoroDataToJson(loroObject) as TypeToSnapshotIn<TType>

  const boundObject = loroBindingContext.apply(
    () => fromSnapshot(mobxKeystoneType, loroJson),
    bindingContext
  )
  try {
    let lastNativeSnapshot: unknown = loroJson
    while (true) {
      if (!loroDoc.getPathToContainer(loroObject.id)) {
        throw failure("cannot bind a Loro container deleted during initialization")
      }
      const nativeSnapshot = convertLoroDataToJson(loroObject)
      const modelSnapshot = getSnapshot(boundObject)
      const merged = mergeSnapshotChanges(lastNativeSnapshot, nativeSnapshot, modelSnapshot)
      lastNativeSnapshot = nativeSnapshot
      if (merged === modelSnapshot) break
      loroBindingContext.apply(
        () => applySnapshot(boundObject as object, merged as object),
        bindingContext
      )
    }
    const finalSnapshot = getSnapshot(boundObject)
    if (!jsonEquals(lastNativeSnapshot, finalSnapshot)) {
      if (loroObject instanceof LoroMap) {
        applyJsonObjectToLoroMap(loroObject, finalSnapshot as PlainObject, { mode: "merge" })
      } else if (loroObject instanceof LoroMovableList) {
        applyJsonArrayToLoroMovableList(loroObject, finalSnapshot as PlainArray, { mode: "merge" })
      } else if (loroObject instanceof LoroText) {
        // For LoroText, we need to handle LoroTextModel snapshot
        const snapshot = finalSnapshot as Record<string, unknown>
        if (snapshot.$modelType === loroTextModelId) {
          replaceLoroTextDelta(loroObject, extractTextDeltaFromSnapshot(snapshot.deltaList))
        }
      }

      loroDoc.commit({ origin: loroOrigin })
    }
  } catch (error) {
    loroBindingContext.set(boundObject, undefined)
    throw error
  }

  // The first commit may include list edits already loaded above.
  let reconcileInitialCommit = loroDoc.getPendingTxnLength() > 0
  let needsSnapshotRecovery = false

  // bind any changes from Loro to mobx-keystone
  const loroSubscribeCb = action((eventBatch: LoroEventBatch) => {
    if (disposed) return
    reportLoroEventsChanged(loroObject, eventBatch.events)
    const isBindingCommit = eventBatch.origin === loroOrigin
    // Final map assignments/deletions can safely include our own writes again.
    // Unlike list diffs, they cannot repeat a splice already applied locally.
    const replayMixedMaps =
      isBindingCommit &&
      reconcileBindingCommit &&
      !needsSnapshotRecovery &&
      !reconcileInitialCommit &&
      eventBatch.events.every((event) => event.diff.type === "map")
    let reconcileSnapshot =
      needsSnapshotRecovery || reconcileInitialCommit || (isBindingCommit && reconcileBindingCommit)
    reconcileInitialCommit = false
    if (isBindingCommit) {
      reconcileBindingCommit = false
      if (!reconcileSnapshot) {
        return
      }
    }

    // A nested container may have moved or been deleted since binding.
    const rootLoroPath = loroDoc.getPathToContainer(loroObject.id)
    if (!rootLoroPath) {
      dispose()
      return
    }

    if (!isBindingCommit) {
      // Other top-level roots cannot affect this binding. In particular, do
      // not prematurely flush and reconcile its pending changes for them.
      if (!eventBatch.events.some((event) => event.path[0] === rootLoroPath[0])) {
        return
      }
      if (pendingChanges.length > 0 || pendingMoves.length > 0 || reconcileReentrantChanges) {
        // The Loro commit happened before the surrounding model action finished.
        // Flush its queued changes, then reconcile the combined state once.
        // Reentrant edits queue only moves, so check every kind of queued work.
        flushPendingChanges()
        reconcileSnapshot = true
      }
    }

    // Track newly inserted containers to avoid double-processing their events
    const newlyInsertedContainers = new Set<ContainerID>()

    let reconciled: ReturnType<typeof applyLoroEventsToMobx>

    // Collect init changes that occur during event application
    // (e.g., fromSnapshot calls that trigger onInit hooks)
    // We store both target and change so we can compute the correct path later
    // Snapshots are captured immediately to preserve values at init time
    const initChanges: { target: object; change: DeepChange; attached: boolean }[] = []
    let hasAttachedInitChanges = false
    const attachedInitSnapshots = new Map<object, unknown>()
    const disposeGlobalListener = onGlobalDeepChange((target, change) => {
      if (change.isInit) {
        const attached = getParentToChildPath(boundObject, target) !== undefined
        const captured = captureChangeSnapshots(change)
        initChanges.push({ target, change: captured, attached })
        if (attached) {
          // Capture stored values directly, including with older core versions
          // that notify deep-change listeners before snapshot invalidation.
          // Capture the post-change value to recognize edits already included in
          // a later snapshot writeback, especially non-idempotent array splices.
          if (
            captured.type === DeepChangeType.ArraySplice ||
            captured.type === DeepChangeType.ArrayUpdate
          ) {
            attachedInitSnapshots.set(
              target,
              Array.from(change.target as unknown[], (value) =>
                isTreeNode(value) ? getSnapshot(value) : value
              )
            )
          } else {
            const snapshot = { ...getSnapshot(target) } as Record<string, unknown>
            if (captured.type === DeepChangeType.ObjectRemove) delete snapshot[captured.key]
            else
              Object.defineProperty(snapshot, captured.key, {
                value: captured.newValue,
                enumerable: true,
                configurable: true,
                writable: true,
              })
            attachedInitSnapshots.set(target, snapshot)
          }
        }
        hasAttachedInitChanges ||= attached
      }
    })

    applyingLoroChangesToMobxKeystone++
    try {
      try {
        loroBindingContext.apply(() => {
          if (reconcileSnapshot && !replayMixedMaps) {
            // The commit also contains edits made directly in Loro. Reconcile the
            // final state, since replaying its list diffs would repeat our own edits.
            const snapshot = convertLoroDataToJson(loroObject) as SnapshotInOf<typeof boundObject>
            applySnapshot(boundObject, snapshot)
            reconciled = { target: boundObject, snapshot }
          } else {
            reconciled = applyLoroEventsToMobx(
              eventBatch.events,
              loroDoc,
              boundObject,
              rootLoroPath,
              newlyInsertedContainers
            )
          }
        }, bindingContext)
      } finally {
        disposeGlobalListener()
      }

      if (disposed) return
      let wroteChanges = false
      const syncedInitTargets = new Set<object>()
      if (reconciled) {
        for (const [target, snapshot] of attachedInitSnapshots) {
          if (
            getParentToChildPath(reconciled.target, target) !== undefined &&
            jsonEquals(getSnapshot(target), snapshot)
          ) {
            syncedInitTargets.add(target)
          }
        }
      }
      // Reconciliation also normalizes defaults and snapshot processors, which
      // need not emit init events. Write only the affected subtree back.
      if (reconciled && !jsonEquals(getSnapshot(reconciled.target), reconciled.snapshot)) {
        const path = getParentToChildPath(boundObject, reconciled.target)
        if (path !== undefined) {
          const container = resolveLoroPath(loroObject, path)
          const snapshot = getSnapshot(reconciled.target)
          if (container instanceof LoroMap) {
            applyJsonObjectToLoroMap(container, snapshot as PlainObject, { mode: "merge" })
          } else if (container instanceof LoroMovableList) {
            applyJsonArrayToLoroMovableList(container, snapshot as PlainArray, { mode: "merge" })
          }
          wroteChanges = true
        }
      }
      // Replay captured init edits last: a later incoming sibling event may
      // otherwise overwrite an onInit hook's intended change.
      for (const { target, change, attached } of initChanges) {
        if (disposed) return
        if (syncedInitTargets.has(target)) continue
        if (
          reconciled &&
          !attached &&
          getParentToChildPath(reconciled.target, target) !== undefined
        )
          continue
        const pathToTarget = getParentToChildPath(boundObject, target)
        if (pathToTarget !== undefined) {
          const changeWithCorrectPath: DeepChange = {
            ...change,
            path: [...pathToTarget, ...change.path],
          }
          applyMobxChangeToLoroObject(changeWithCorrectPath, loroObject)
          wroteChanges = true
        }
      }
      if (wroteChanges && !disposed) {
        reconcileBindingCommit ||= hasAttachedInitChanges && loroDoc.getPendingTxnLength() > 0
        loroDoc.commit({ origin: loroOrigin })
      }
      needsSnapshotRecovery = false
    } catch (error) {
      // The native commit remains even if the model rejected its updates.
      // Recover from a complete snapshot before trusting list indices again.
      needsSnapshotRecovery = true
      throw error
    } finally {
      applyingLoroChangesToMobxKeystone--
    }
  })
  const loroUnsubscribe = loroDoc.subscribe(loroSubscribeCb)

  // bind any changes from mobx-keystone to Loro
  // Collect changes during an action and apply them after the action completes
  let pendingChanges: (DeepChange | ArrayMoveChange)[] = []
  let reconcileReentrantChanges = false
  let lastFlushedSnapshot = getSnapshot(boundObject)
  let pendingMoves: { before: unknown; change: ArrayMoveChange; sequence: number }[] = []
  let moveSequence = 0
  let nonMoveChangeVersion = 0
  let lastMoveChangeVersion = -1
  bindingContext.captureArrayMove = (array, fromIndex, toIndex) => {
    if (disposed || bindingContext.isApplyingLoroChangesToMobxKeystone) return undefined
    const path = getParentToChildPath(boundObject, array)
    if (!path) return undefined
    const sequence = moveSequence++
    const version = nonMoveChangeVersion
    // Consecutive moves need only one checkpoint. Capture a new one when a
    // different edit intervenes, including an edit made inside a move listener.
    const before =
      pendingMoves.length > 0 && lastMoveChangeVersion === version
        ? undefined
        : getSnapshot(boundObject)
    return () => {
      pendingMoves.push({
        before,
        change: { type: "ArrayMove", path, fromIndex, toIndex },
        sequence,
      })
      lastMoveChangeVersion = version
    }
  }

  const disposeOnDeepChange = onDeepChange(boundObject, (change) => {
    // Skip if we're currently applying Loro changes to MobX
    if (bindingContext.isApplyingLoroChangesToMobxKeystone) {
      return
    }

    // Skip init changes - they are handled by the getSnapshot + merge at the end of binding
    if (change.isInit) {
      return
    }

    const moveChange = isChangeForMove(change) ? processChangeForMove(change) : undefined
    if (!moveChange) nonMoveChangeVersion++

    if (change.isReentrant) {
      reconcileReentrantChanges = true
      pendingChanges = []
    }
    if (reconcileReentrantChanges) {
      return
    }

    // Check if this is part of a moveWithinArray operation
    if (moveChange) {
      pendingChanges.push(moveChange)
      return
    }

    // A full text replacement supersedes the preceding replacement to the
    // same node. Preserve ordering across intervening structural changes.
    if (
      change.type === DeepChangeType.ObjectUpdate &&
      change.key === "deltaList" &&
      resolvePath(boundObject, change.path).value instanceof LoroTextModel
    ) {
      const previous = pendingChanges.at(-1)
      if (
        previous?.type === DeepChangeType.ObjectUpdate &&
        previous.key === "deltaList" &&
        previous.target === change.target
      ) {
        pendingChanges.pop()
      }
    }

    // Capture snapshots now before the values can be mutated within the same transaction.
    // This is necessary because changes are collected and applied after the action completes,
    // by which time the original values may have been modified.
    // Example: `obj.items = [a, b]; obj.items.splice(0, 1)` - without early capture,
    // the ObjectUpdate for `items` would get the post-splice array state.
    pendingChanges.push(captureChangeSnapshots(change))
  })

  // Apply collected changes when snapshot changes (i.e., after action completes)
  // Also notify that the loro container atoms have been updated
  const flushPendingChanges = () => {
    if (
      disposed ||
      (pendingChanges.length === 0 && pendingMoves.length === 0 && !reconcileReentrantChanges)
    ) {
      return
    }

    let reconcile = reconcileReentrantChanges
    reconcileReentrantChanges = false
    const previousSnapshot = lastFlushedSnapshot
    const currentSnapshot = getSnapshot(boundObject)
    lastFlushedSnapshot = currentSnapshot
    const changesToApply = pendingChanges
    pendingChanges = []
    const movesToApply = pendingMoves
    pendingMoves = []

    // Skip if we're currently applying Loro changes to MobX
    if (bindingContext.isApplyingLoroChangesToMobxKeystone) {
      return
    }

    // A binding-origin commit must not hide earlier, uncommitted Loro edits.
    reconcileBindingCommit = loroDoc.getPendingTxnLength() > 0
    // The native state cannot change until this flush writes, so one cache
    // serves every path checked below.
    const conflictCache: PendingLoroConflictCache = new WeakMap()
    try {
      if (!reconcile && reconcileBindingCommit) {
        reconcile = changesToApply.some((change) =>
          hasPendingLoroConflict(loroObject, previousSnapshot, change.path, conflictCache)
        )
      }
      if (reconcile) {
        let baseline: unknown = previousSnapshot
        const reconcileSnapshot = (target: unknown) => {
          if (baseline === target) return
          const nativeSnapshot = convertLoroDataToJson(loroObject)
          const snapshot = mergeSnapshotChanges(baseline, target, nativeSnapshot, "merge")
          reconcileLoroModelOrder(loroObject, nativeSnapshot, snapshot)
          if (loroObject instanceof LoroMap) {
            applyJsonObjectToLoroMap(loroObject, snapshot as PlainObject, { mode: "merge" })
          } else if (loroObject instanceof LoroMovableList) {
            applyJsonArrayToLoroMovableList(loroObject, snapshot as PlainArray, { mode: "merge" })
          } else if (loroObject instanceof LoroText) {
            replaceLoroTextDelta(
              loroObject,
              extractTextDeltaFromSnapshot((snapshot as Record<string, unknown>).deltaList)
            )
          }
          baseline = target
        }
        // A nested move finishes first, but its outer move mutated the array first.
        movesToApply.sort((a, b) => a.sequence - b.sequence)
        // A native move needs the list the model saw. A pending native insertion
        // or deletion invalidates its indices, so let the merge reorder instead.
        const replayMoves =
          !reconcileBindingCommit ||
          !movesToApply.some((move) =>
            hasPendingLoroConflict(loroObject, previousSnapshot, move.change.path, conflictCache)
          )
        if (replayMoves)
          for (const move of movesToApply) {
            if (move.before !== undefined) reconcileSnapshot(move.before)
            applyMobxChangeToLoroObject(move.change, loroObject)
            baseline = applyArrayMoveToSnapshot(baseline, move.change)
          }
        reconcileSnapshot(currentSnapshot)
      }
      if (!reconcile)
        for (const change of changesToApply) {
          applyMobxChangeToLoroObject(change, loroObject)
        }
      loroDoc.commit({ origin: loroOrigin })
    } finally {
      reconcileBindingCommit = false
    }
  }
  bindingContext.flushPendingChanges = flushPendingChanges
  const disposeOnSnapshot = onSnapshot(boundObject, () => {
    flushPendingChanges()
    lastFlushedSnapshot = getSnapshot(boundObject)
  })

  const dispose = action(() => {
    if (disposed) return
    disposed = true
    pendingChanges = []
    pendingMoves = []
    loroUnsubscribe()
    disposeOnDeepChange()
    disposeOnSnapshot()
    bindingContext.flushPendingChanges = undefined
    bindingContext.captureArrayMove = undefined
    loroBindingContext.set(boundObject, undefined)
  })

  // Publish readiness only after initialization and all synchronization hooks.
  try {
    if (!loroDoc.getPathToContainer(loroObject.id)) {
      throw failure("cannot bind a Loro container deleted during initialization")
    }
    bindingContext.boundObject = boundObject
    loroBindingContext.set(boundObject, bindingContext)
  } catch (error) {
    dispose()
    throw error
  }

  return {
    boundObject,
    dispose,
    loroOrigin,
  }
}
