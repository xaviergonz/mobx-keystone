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
  AnyDataModel,
  AnyModel,
  AnyStandardType,
  DeepChange,
  DeepChangeType,
  fromSnapshot,
  getParentToChildPath,
  getSnapshot,
  isTreeNode,
  ModelClass,
  onDeepChange,
  onGlobalDeepChange,
  onSnapshot,
  resolvePath,
  SnapshotOutOf,
  TypeToData,
} from "mobx-keystone"
import { nanoid } from "nanoid"
import type { PlainArray, PlainObject } from "../plainTypes"
import { getOrCreateLoroCollectionAtom } from "../utils/getOrCreateLoroCollectionAtom"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"

import { applyLoroEventToMobx, ReconciliationMap } from "./applyLoroEventToMobx"
import { applyMobxChangeToLoroObject } from "./applyMobxChangeToLoroObject"
import {
  applyDeltaToLoroText,
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  extractTextDeltaFromSnapshot,
} from "./convertJsonToLoroData"
import { convertLoroDataToJson } from "./convertLoroDataToJson"
import { loroTextModelId } from "./LoroTextModel"
import { type LoroBindingContext, loroBindingContext } from "./loroBindingContext"
import { setLoroContainerSnapshot } from "./loroSnapshotTracking"
import {
  type ArrayMoveChange,
  isInMoveContextForArray,
  processChangeForMove,
} from "./moveWithinArray"

/**
 * Captures snapshots of tree nodes in a DeepChange.
 * This ensures values are captured at change time, not at apply time,
 * preventing issues when values are mutated after being added to a collection.
 */
function captureChangeSnapshots(change: DeepChange): DeepChange {
  if (change.type === DeepChangeType.ArraySplice && change.addedValues.length > 0) {
    const snapshots = change.addedValues.map((v) => (isTreeNode(v) ? getSnapshot(v) : v))
    return { ...change, addedValues: snapshots }
  } else if (change.type === DeepChangeType.ArrayUpdate) {
    const snapshot = isTreeNode(change.newValue) ? getSnapshot(change.newValue) : change.newValue
    return { ...change, newValue: snapshot }
  } else if (
    change.type === DeepChangeType.ObjectAdd ||
    change.type === DeepChangeType.ObjectUpdate
  ) {
    const snapshot = isTreeNode(change.newValue) ? getSnapshot(change.newValue) : change.newValue
    return { ...change, newValue: snapshot }
  }
  return change
}

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
  const loroOrigin = `bindLoroToMobxKeystoneTransactionOrigin-${nanoid()}`

  let applyingLoroChangesToMobxKeystone = 0

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

  const loroJson = convertLoroDataToJson(loroObject) as SnapshotOutOf<TypeToData<TType>>

  let boundObject: TypeToData<TType>

  // Track if any init changes occurred during fromSnapshot
  // If they did, we need to sync the model snapshot to the CRDT
  let hasInitChanges = false

  const createBoundObject = () => {
    // Set up a temporary global listener to detect init changes during fromSnapshot
    const disposeGlobalListener = onGlobalDeepChange((_target, change) => {
      if (change.isInit) {
        hasInitChanges = true
      }
    })

    try {
      const result = loroBindingContext.apply(
        () => fromSnapshot(mobxKeystoneType, loroJson),
        bindingContext
      )
      loroBindingContext.set(result, { ...bindingContext, boundObject: result })
      return result
    } finally {
      disposeGlobalListener()
    }
  }

  boundObject = createBoundObject()

  // Get the path to the root Loro object for path resolution
  const rootLoroPath = loroDoc.getPathToContainer(loroObject.id) ?? []

  // bind any changes from Loro to mobx-keystone
  const loroSubscribeCb = action((eventBatch: LoroEventBatch) => {
    // Skip changes that originated from this binding
    if (eventBatch.origin === loroOrigin) {
      return
    }

    // Track newly inserted containers to avoid double-processing their events
    const newlyInsertedContainers = new Set<ContainerID>()

    // Create a map to store reconciliation data for this batch
    const reconciliationMap: ReconciliationMap = new Map()

    // Collect init changes that occur during event application
    // (e.g., fromSnapshot calls that trigger onInit hooks)
    // We store both target and change so we can compute the correct path later
    // Snapshots are captured immediately to preserve values at init time
    const initChanges: { target: object; change: DeepChange }[] = []
    const disposeGlobalListener = onGlobalDeepChange((target, change) => {
      if (change.isInit) {
        initChanges.push({ target, change: captureChangeSnapshots(change) })
      }
    })

    applyingLoroChangesToMobxKeystone++
    try {
      try {
        for (const event of eventBatch.events) {
          applyLoroEventToMobx(
            event,
            loroDoc,
            boundObject,
            rootLoroPath,
            reconciliationMap,
            newlyInsertedContainers
          )
        }
      } finally {
        disposeGlobalListener()
      }

      // Sync back any init-time mutations from fromSnapshot calls
      // (e.g., onInit hooks that modify the model)
      // This is needed because init changes during Loro event handling are not
      // captured by the main onDeepChange (it skips changes when applyingLoroChangesToMobxKeystone > 0)
      if (initChanges.length > 0) {
        loroDoc.setNextCommitOrigin(loroOrigin)

        for (const { target, change } of initChanges) {
          // Compute the path from boundObject to the target
          const pathToTarget = getParentToChildPath(boundObject, target)
          if (pathToTarget !== undefined) {
            // Create a new change with the correct path from the root
            const changeWithCorrectPath: DeepChange = {
              ...change,
              path: [...pathToTarget, ...change.path],
            }
            applyMobxChangeToLoroObject(changeWithCorrectPath, loroObject)
          }
        }

        loroDoc.commit()
      }

      // Update snapshot tracking: the Loro container is now in sync with the current MobX snapshot
      // This enables the merge optimization to skip unchanged subtrees during reconciliation
      if (loroObject instanceof LoroMap || loroObject instanceof LoroMovableList) {
        setLoroContainerSnapshot(loroObject, getSnapshot(boundObject))
      }
    } finally {
      applyingLoroChangesToMobxKeystone--
    }
  })
  const loroUnsubscribe = loroDoc.subscribe(loroSubscribeCb)

  // bind any changes from mobx-keystone to Loro
  // Collect changes during an action and apply them after the action completes
  let pendingChanges: (DeepChange | ArrayMoveChange)[] = []

  const disposeOnDeepChange = onDeepChange(boundObject, (change) => {
    // Skip if we're currently applying Loro changes to MobX
    if (bindingContext.isApplyingLoroChangesToMobxKeystone) {
      return
    }

    // Skip init changes - they are handled by the getSnapshot + merge at the end of binding
    if (change.isInit) {
      return
    }

    // Check if this is part of a moveWithinArray operation
    if (change.type === DeepChangeType.ArraySplice) {
      const resolved = resolvePath(boundObject, change.path)
      if (resolved.resolved && isInMoveContextForArray(resolved.value as unknown[])) {
        const moveResult = processChangeForMove(change)

        if (moveResult === undefined) {
          // Intercepted but move not complete - skip this change
          return
        }

        // Move complete - add the move change instead
        pendingChanges.push(moveResult)
        return
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
  const disposeOnSnapshot = onSnapshot(boundObject, () => {
    if (pendingChanges.length === 0) {
      return
    }

    const changesToApply = pendingChanges
    pendingChanges = []

    // Skip if we're currently applying Loro changes to MobX
    if (bindingContext.isApplyingLoroChangesToMobxKeystone) {
      return
    }

    loroDoc.setNextCommitOrigin(loroOrigin)

    // Apply all changes directly to Loro
    for (const change of changesToApply) {
      applyMobxChangeToLoroObject(change, loroObject)
    }

    loroDoc.commit()

    // Update snapshot tracking: the Loro container is now in sync with the current MobX snapshot
    if (loroObject instanceof LoroMap || loroObject instanceof LoroMovableList) {
      setLoroContainerSnapshot(loroObject, getSnapshot(boundObject))
    }

    // Notify MobX that the Loro container has been updated
    getOrCreateLoroCollectionAtom(loroObject).reportChanged()
  })

  // Sync the model snapshot to the CRDT if any init changes occurred.
  // Init changes include: defaults being applied, onInit hooks mutating the model.
  // This is an optimization: if no init changes occurred, we skip the sync entirely.
  const finalSnapshot = getSnapshot(boundObject)

  if (hasInitChanges) {
    loroDoc.setNextCommitOrigin(loroOrigin)

    if (loroObject instanceof LoroMap) {
      applyJsonObjectToLoroMap(loroObject, finalSnapshot as PlainObject, { mode: "merge" })
    } else if (loroObject instanceof LoroMovableList) {
      applyJsonArrayToLoroMovableList(loroObject, finalSnapshot as PlainArray, { mode: "merge" })
    } else if (loroObject instanceof LoroText) {
      // For LoroText, we need to handle LoroTextModel snapshot
      const snapshot = finalSnapshot as Record<string, unknown>
      if (snapshot.$modelType === loroTextModelId) {
        // Clear existing content and apply deltas
        if (loroObject.length > 0) {
          loroObject.delete(0, loroObject.length)
        }
        const deltas = extractTextDeltaFromSnapshot(snapshot.deltaList)
        if (deltas.length > 0) {
          applyDeltaToLoroText(loroObject, deltas)
        }
      }
    }

    loroDoc.commit()
  }

  // Always update snapshot tracking after binding initialization
  // This ensures the merge optimization can skip unchanged subtrees in future reconciliations
  if (loroObject instanceof LoroMap || loroObject instanceof LoroMovableList) {
    setLoroContainerSnapshot(loroObject, finalSnapshot)
  }

  const dispose = () => {
    loroUnsubscribe()
    disposeOnDeepChange()
    disposeOnSnapshot()
  }

  return {
    boundObject,
    dispose,
    loroOrigin,
  }
}
