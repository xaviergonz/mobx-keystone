import {
  captureChangeSnapshots,
  jsonEquals,
  mergeSnapshotChanges,
} from "@mobx-keystone/crdt-binding-common"
import { action } from "mobx"
import {
  type AnyDataModel,
  type AnyModel,
  type AnyStandardType,
  applySnapshot,
  type DeepChange,
  DeepChangeType,
  fromSnapshot,
  getParent,
  getParentToChildPath,
  getSnapshot,
  type ModelClass,
  onDeepChange,
  onGlobalDeepChange,
  onSnapshot,
  type Path,
  resolvePath,
  type TypeToData,
  type TypeToSnapshotIn,
} from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { isYjsValueDeleted } from "../utils/isYjsValueDeleted"
import { getYjsCollectionAtom } from "../utils/yjsCollectionAtoms"
import { applyMobxChangeToYjsObject } from "./applyMobxChangeToYjsObject"
import { applyYjsEventsToMobx } from "./applyYjsEventToMobx"
import { applySnapshotToYjsContainer } from "./convertJsonToYjsData"
import { convertYjsDataToJson } from "./convertYjsDataToJson"
import { hasYjsModelIdentityConflict } from "./hasYjsModelIdentityConflict"
import { reconcileYjsContainerPositions } from "./reconcileYjsContainerPositions"
import { resolveYjsPath } from "./resolveYjsPath"
import { replaceYjsText } from "./textDelta"
import { YjsTextModel } from "./YjsTextModel"
import { type YjsBindingContext, yjsBindingContext } from "./yjsBindingContext"

// A transaction may contain writes from more than one binding, even though
// Yjs assigns it just one origin. Such transactions must reach every writer.
const transactionWriters = new WeakMap<Y.Transaction, Set<symbol>>()
const precedingTransactionWriter = Symbol("precedingTransactionWriter")

function registerTransactionWriter(
  transaction: Y.Transaction,
  origin: symbol,
  root: Y.AbstractType<any>
) {
  let writers = transactionWriters.get(transaction)
  if (!writers) {
    writers = new Set()
    transactionWriters.set(transaction, writers)
  }
  // beforeTransaction hooks run before our callback and may already have
  // changed Yjs. The transaction origin alone cannot identify those writes
  // as ours. Reconcile the final state whenever our callback inherits changes.
  if (transaction.origin === origin && transaction.changed.size > 0) {
    for (const changed of transaction.changed.keys()) {
      let current: Y.AbstractType<any> | null = changed
      while (current && current !== root) current = current.parent
      if (current === root) {
        writers.add(precedingTransactionWriter)
        break
      }
    }
  }
  writers.add(origin)
}

/**
 * Creates a bidirectional binding between a Y.js data structure and a mobx-keystone model.
 */
export function bindYjsToMobxKeystone<
  TType extends AnyStandardType | ModelClass<AnyModel> | ModelClass<AnyDataModel>,
>({
  yjsDoc,
  yjsObject,
  mobxKeystoneType,
}: {
  /**
   * The Y.js document.
   */
  yjsDoc: Y.Doc
  /**
   * The bound Y.js data structure.
   */
  yjsObject: Y.Map<any> | Y.Array<any> | Y.Text
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
   * The Y.js origin symbol used for binding transactions.
   */
  yjsOrigin: symbol
} {
  if (yjsObject.doc !== yjsDoc) {
    throw failure("the Yjs object must be attached to the supplied document")
  }

  const yjsOrigin = Symbol("bindYjsToMobxKeystoneTransactionOrigin")

  let applyingYjsChangesToMobxKeystone = 0

  const bindingContext: YjsBindingContext = {
    yjsDoc,
    yjsObject,
    mobxKeystoneType,
    yjsOrigin,
    boundObject: undefined, // not yet created

    get isApplyingYjsChangesToMobxKeystone() {
      return applyingYjsChangesToMobxKeystone > 0
    },
  }

  if (isYjsValueDeleted(yjsObject)) {
    throw failure("cannot apply patch to deleted Yjs value")
  }

  const yjsJson = convertYjsDataToJson(yjsObject)

  const boundObject = yjsBindingContext.apply(
    () => fromSnapshot(mobxKeystoneType, yjsJson as unknown as TypeToSnapshotIn<TType>),
    bindingContext
  )

  let hasInitChanges: boolean
  try {
    // onInit can edit native Yjs through the temporary binding context before
    // our observers exist. Include those edits without discarding unrelated
    // model defaults or initialization changes. Recheck after reconciliation,
    // since newly created descendants can have their own initialization hooks.
    let lastNativeSnapshot = yjsJson
    while (true) {
      if (isYjsValueDeleted(yjsObject)) {
        throw failure("cannot bind a Yjs value deleted during initialization")
      }
      const nativeSnapshot = convertYjsDataToJson(yjsObject)
      const modelSnapshot = getSnapshot(boundObject)
      const merged = mergeSnapshotChanges(lastNativeSnapshot, nativeSnapshot, modelSnapshot)
      lastNativeSnapshot = nativeSnapshot
      if (merged === modelSnapshot) break
      yjsBindingContext.apply(
        () => applySnapshot(boundObject as object, merged as object),
        bindingContext
      )
    }

    // Compare the completed snapshot so metadata added by fromSnapshot is
    // synchronized even when no defaults or onInit edits emit deep changes.
    hasInitChanges = !jsonEquals(getSnapshot(boundObject), lastNativeSnapshot)
  } catch (error) {
    yjsBindingContext.unset(boundObject)
    throw error
  }

  let disposed = false
  const transactionsWithLocalChanges = new WeakSet<Y.Transaction>()
  let needsSnapshotRecovery = false

  // bind any changes from yjs to mobx-keystone
  const observeDeepCb = action((events: Y.YEvent<any>[]) => {
    // Yjs may already have queued this callback when another observer disposes us.
    if (disposed) return
    const eventsToApply: Y.YEvent<any>[] = []

    events.forEach((event) => {
      const emptyCollectionEvent =
        (event instanceof Y.YArrayEvent && event.changes.delta.length === 0) ||
        (event instanceof Y.YMapEvent && event.changes.keys.size === 0)
      if (
        (needsSnapshotRecovery ||
          event.transaction.origin !== yjsOrigin ||
          (transactionWriters.get(event.transaction)?.size ?? 0) > 1) &&
        // Locally edited/new bindings may differ from a transaction's starting
        // state even when its final changes are empty. Only read lazy text
        // deltas for incoming events that might be applied.
        (needsSnapshotRecovery ||
          transactionsWithLocalChanges.has(event.transaction) ||
          (!emptyCollectionEvent && (!(event instanceof Y.YTextEvent) || event.delta.length > 0)))
      ) {
        eventsToApply.push(event)
      }

      if (event instanceof Y.YMapEvent) {
        for (const key of event.keysChanged) {
          getYjsCollectionAtom(event.target, key)?.reportChanged()
        }
      } else if (event instanceof Y.YArrayEvent && !emptyCollectionEvent) {
        getYjsCollectionAtom(event.target)?.reportChanged()
      }
    })

    if (eventsToApply.length > 0) {
      applyingYjsChangesToMobxKeystone++
      try {
        let hasIncomingInitChanges = false
        let initTargets: Set<object> | undefined
        const attachedInitChanges: { target: object; change: DeepChange }[] = []
        const disposeGlobalListener = onGlobalDeepChange((target, change) => {
          if (!change.isInit) return
          ;(initTargets ??= new Set()).add(target)
          if (getParentToChildPath(boundObject, target) === undefined) return
          const captured = captureChangeSnapshots(change)
          attachedInitChanges.push({ target, change: captured })
        })

        try {
          // Apply a temporary context without making newly created children
          // providers; they inherit the root context once attached.
          yjsBindingContext.apply(() => {
            if (
              needsSnapshotRecovery ||
              transactionsWithLocalChanges.has(eventsToApply[0].transaction)
            ) {
              // Local writes or a rejected earlier transaction can leave MobX
              // different from the starting state assumed by these deltas.
              // Reconcile the final native snapshot before resuming increments.
              const snapshot = convertYjsDataToJson(yjsObject) as object
              applySnapshot(boundObject as object, snapshot)
              hasIncomingInitChanges ||= !jsonEquals(getSnapshot(boundObject), snapshot)
            } else {
              const normalizedSnapshot = applyYjsEventsToMobx(eventsToApply, boundObject)
              hasIncomingInitChanges ||= normalizedSnapshot
            }
          }, yjsBindingContext.get(boundObject))
        } finally {
          disposeGlobalListener()
        }

        // Initialization can also create unrelated helper models. Check final
        // ancestry, after initialized descendants have been attached.
        let initSyncTarget: object = boundObject
        if (!hasIncomingInitChanges && initTargets) {
          let commonPath: (string | number)[] | undefined
          for (const target of initTargets) {
            const parent = getParent(target)
            const node = parent instanceof YjsTextModel ? parent : target
            const path = getParentToChildPath(boundObject, node)
            if (path === undefined) continue
            if (commonPath === undefined) commonPath = [...path]
            else {
              let length = 0
              while (length < commonPath.length && commonPath[length] === path[length]) length++
              commonPath.length = length
            }
          }
          if (commonPath !== undefined) {
            hasIncomingInitChanges = true
            initSyncTarget = resolvePath(boundObject, commonPath).value
          }
        }

        // Nested defaults may create a parent after its children's init edits.
        // Merge the final snapshot rather than replaying those edits out of order.
        if (hasIncomingInitChanges && !isYjsValueDeleted(yjsObject)) {
          const changesToReplay = attachedInitChanges.flatMap(({ target, change }) => {
            const path = getParentToChildPath(boundObject, target)
            if (path === undefined) return []
            return [{ ...change, path: [...path, ...change.path] }]
          })
          syncInitialSnapshot(
            changesToReplay,
            changesToReplay.length > 0 ? boundObject : initSyncTarget
          )
        }
        needsSnapshotRecovery = false
      } catch (error) {
        // Yjs has committed even when model validation/reconciliation fails.
        // Future deltas cannot safely be applied to the rolled-back model.
        needsSnapshotRecovery = true
        throw error
      } finally {
        applyingYjsChangesToMobxKeystone--
      }
    }
  })

  yjsObject.observeDeep(observeDeepCb)

  // bind any changes from mobx-keystone to yjs using deep change observation
  // This provides proper splice detection for array operations
  type PendingChange =
    | DeepChange
    | {
        textPath: Path
        deltas: readonly { readonly data: readonly unknown[] }[]
        replace: boolean
      }
  let pendingChanges: PendingChange[] = []
  let reconcileReentrantChanges = false
  let lastFlushedSnapshot = getSnapshot(boundObject)

  let nativeTransaction: Y.Transaction | undefined

  const disposeOnDeepChange = onDeepChange(boundObject, (change) => {
    if (disposed || applyingYjsChangesToMobxKeystone > 0) {
      return
    }

    // Skip init changes - they are handled by the getSnapshot + merge at the end of binding
    if (change.isInit) {
      return
    }

    if (change.isReentrant) {
      reconcileReentrantChanges = true
      pendingChanges = []
    }
    if (reconcileReentrantChanges) {
      if (nativeTransaction) flushPendingChanges()
      return
    }

    // Array changes already carry the tree node. Only delta-list property
    // changes need path resolution to recover a model from its data object.
    const textModel =
      change.type === DeepChangeType.ArraySplice || change.type === DeepChangeType.ArrayUpdate
        ? getParent(change.target)
        : change.key === "deltaList"
          ? resolvePath(boundObject, change.path).value
          : undefined
    if (textModel instanceof YjsTextModel) {
      const append =
        change.type === DeepChangeType.ArraySplice &&
        change.removedValues.length === 0 &&
        change.index + change.addedValues.length === change.target.length
      const textPath = getParentToChildPath(boundObject, textModel)!
      const previous = pendingChanges.at(-1)
      // A complete replacement supersedes the immediately preceding edit to
      // this text. Intervening structural edits keep their original ordering.
      if (
        !append &&
        previous &&
        "textPath" in previous &&
        previous.textPath.length === textPath.length &&
        previous.textPath.every((part, index) => part === textPath[index])
      ) {
        pendingChanges.pop()
      }
      // Copy the current list: the enclosing model snapshot may not yet be
      // invalidated while this deep-change listener is running.
      pendingChanges.push({
        textPath,
        deltas: textModel.deltaList.slice(append ? change.index : 0),
        replace: !append,
      })
      if (nativeTransaction) {
        flushPendingChanges()
      }
      return
    }

    // Capture snapshots now before the values can be mutated within the same transaction.
    // This is necessary because changes are collected and applied after the action completes,
    // by which time the original values may have been modified.
    // Example: `obj.items = [a, b]; obj.items.splice(0, 1)` - without early capture,
    // the ObjectUpdate for `items` would get the post-splice array state.
    pendingChanges.push(captureChangeSnapshots(change))
    if (nativeTransaction) {
      flushPendingChanges()
    }
  })

  // this is only used so we can transact all changes to the snapshot boundary
  const flushPendingChanges = () => {
    if (pendingChanges.length === 0 && !reconcileReentrantChanges) {
      return
    }

    const reconcile = reconcileReentrantChanges
    reconcileReentrantChanges = false
    const previousSnapshot = lastFlushedSnapshot
    const currentSnapshot = getSnapshot(boundObject)
    lastFlushedSnapshot = currentSnapshot
    const changesToApply = pendingChanges
    pendingChanges = []

    // Skip syncing to Yjs if the Yjs object has been deleted/detached
    if (isYjsValueDeleted(yjsObject)) {
      return
    }

    yjsDoc.transact((transaction) => {
      // beforeTransaction listeners can dispose the binding after capture.
      if (disposed || isYjsValueDeleted(yjsObject)) return
      registerTransactionWriter(transaction, yjsOrigin, yjsObject)
      transactionsWithLocalChanges.add(transaction)
      const reconcileSnapshot =
        reconcile ||
        (transaction.changed.size > 0 &&
          changesToApply.some((change) =>
            hasYjsModelIdentityConflict(
              yjsObject,
              previousSnapshot,
              "textPath" in change ? change.textPath : change.path
            )
          ))
      if (reconcileSnapshot) {
        const nativeSnapshot = convertYjsDataToJson(yjsObject)
        const snapshot = mergeSnapshotChanges(
          previousSnapshot,
          currentSnapshot,
          nativeSnapshot,
          "merge"
        )
        reconcileYjsContainerPositions(yjsObject, nativeSnapshot, snapshot)
        applySnapshotToYjsContainer(yjsObject, snapshot)
      } else {
        changesToApply.forEach((change) => {
          if ("textPath" in change) {
            const text = resolveYjsPath(yjsObject, change.textPath)
            if (!(text instanceof Y.Text)) {
              throw failure("expected Y.Text while applying text changes")
            }
            if (change.replace) {
              replaceYjsText(text, change.deltas)
            } else {
              for (const delta of change.deltas) {
                text.applyDelta(delta.data as unknown[])
              }
            }
          } else {
            applyMobxChangeToYjsObject(change, yjsObject)
          }
        })
      }
    }, yjsOrigin)
  }

  const disposeOnSnapshot = onSnapshot(boundObject, () => {
    flushPendingChanges()
    lastFlushedSnapshot = getSnapshot(boundObject)
  })
  // Flush queued model edits before a native Yjs transaction changes indices.
  const beforeTransaction = (transaction: Y.Transaction) => {
    if (transaction.origin !== yjsOrigin) {
      nativeTransaction = transaction
    }
    flushPendingChanges()
  }
  const beforeObserverCalls = (transaction: Y.Transaction) => {
    // A deleted subtree does not receive deep events for its own deletion.
    // Release the binding through the document hook instead.
    if (isYjsValueDeleted(yjsObject)) {
      dispose()
      return
    }
    if (nativeTransaction === transaction) {
      nativeTransaction = undefined
    }
  }
  yjsDoc.on("beforeTransaction", beforeTransaction)
  yjsDoc.on("beforeObserverCalls", beforeObserverCalls)

  function syncInitialSnapshot(
    initChangesToReplay: DeepChange[] = [],
    target: object = boundObject
  ) {
    yjsDoc.transact((transaction) => {
      // beforeTransaction listeners can dispose the binding after capture.
      if (disposed || isYjsValueDeleted(yjsObject)) return
      registerTransactionWriter(transaction, yjsOrigin, yjsObject)
      transactionsWithLocalChanges.add(transaction)
      if (initChangesToReplay.length > 0) {
        // Native data contains the completed incoming transaction but none of
        // these model-only initialization edits. Replay them once before model
        // normalization, preserving unrelated defaults and initialization edits.
        const before = convertYjsDataToJson(yjsObject)
        for (const change of initChangesToReplay) applyMobxChangeToYjsObject(change, yjsObject)
        const merged = mergeSnapshotChanges(
          before,
          convertYjsDataToJson(yjsObject),
          getSnapshot(boundObject)
        )
        applySnapshot(boundObject as object, merged as object)
      }
      const container = resolveYjsPath(yjsObject, getParentToChildPath(boundObject, target)!)
      applySnapshotToYjsContainer(container, getSnapshot(target))
    }, yjsOrigin)
  }

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    pendingChanges = []
    nativeTransaction = undefined
    yjsDoc.off("destroy", dispose)
    yjsDoc.off("beforeTransaction", beforeTransaction)
    yjsDoc.off("beforeObserverCalls", beforeObserverCalls)
    disposeOnDeepChange()
    disposeOnSnapshot()
    yjsObject.unobserveDeep(observeDeepCb)
    // Context changes may synchronously run user reactions. Stop syncing first.
    yjsBindingContext.unset(boundObject)
  }

  yjsDoc.on("destroy", dispose)
  try {
    // If binding began inside an existing transaction, its eventual event also
    // includes edits already loaded by fromSnapshot. Reconcile that first event.
    yjsDoc.transact((transaction) => {
      // beforeTransaction listeners can dispose the binding after capture.
      if (disposed || isYjsValueDeleted(yjsObject)) return
      registerTransactionWriter(transaction, yjsOrigin, yjsObject)
      transactionsWithLocalChanges.add(transaction)
      if (transaction.origin !== yjsOrigin) {
        nativeTransaction = transaction
      }
    }, yjsOrigin)

    if (hasInitChanges) {
      syncInitialSnapshot()
    }
    // Context publication can activate user reactions that edit Yjs. Finish
    // initial synchronization first, so it cannot overwrite those edits even
    // when binding inside an open native transaction.
    if (!disposed) {
      yjsBindingContext.set(boundObject, {
        ...bindingContext,
        boundObject,
        get isApplyingYjsChangesToMobxKeystone() {
          return applyingYjsChangesToMobxKeystone > 0
        },
      })
    }
  } catch (error) {
    dispose()
    throw error
  }

  return {
    boundObject,
    dispose,
    yjsOrigin,
  }
}
