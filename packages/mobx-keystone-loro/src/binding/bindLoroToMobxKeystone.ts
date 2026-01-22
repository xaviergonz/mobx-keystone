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
  fromSnapshot,
  getParentToChildPath,
  getSnapshot,
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
import { analyzeChanges } from "./analyzeArrayChanges"
import { applyLoroEventToMobx, ReconciliationMap } from "./applyLoroEventToMobx"
import { applyMobxChangeToLoroObject } from "./applyMobxChangeToLoroObject"
import {
  applyDeltaToLoroText,
  applyJsonArrayToLoroMovableList,
  applyJsonObjectToLoroMap,
  extractTextDeltaFromSnapshot,
} from "./convertJsonToLoroData"
import { convertLoroDataToJson } from "./convertLoroDataToJson"
import { type EnhancedDeepChange, enhanceDeepChange } from "./enhanceDeepChange"
import { loroTextModelId } from "./LoroTextModel"
import { type LoroBindingContext, loroBindingContext } from "./loroBindingContext"
import { setLoroContainerSnapshot } from "./loroSnapshotTracking"
import { reconcileLoroMovableList } from "./reconcileLoroMovableList"
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
    // Enhanced changes have snapshots captured at emission time
    const initChanges: { target: object; change: EnhancedDeepChange }[] = []
    const disposeGlobalListener = onGlobalDeepChange((target, change) => {
      if (change.isInit) {
        // Enhance immediately to capture snapshot before any further mutations
        initChanges.push({ target, change: enhanceDeepChange(change) })
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
            // The change is already enhanced with snapshots
            const changeWithCorrectPath: EnhancedDeepChange = {
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
  // Collect enhanced changes during an action and apply them after the action completes
  // Changes are enhanced immediately to capture snapshots before any further mutations
  let pendingChanges: EnhancedDeepChange[] = []

  const disposeOnDeepChange = onDeepChange(boundObject, (change) => {
    // Skip if we're currently applying Loro changes to MobX
    if (bindingContext.isApplyingLoroChangesToMobxKeystone) {
      return
    }

    // Skip init changes - they are handled by the getSnapshot + merge at the end of binding
    if (change.isInit) {
      return
    }

    // Enhance the change immediately to capture snapshot before any further mutations
    pendingChanges.push(enhanceDeepChange(change))
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

    // Analyze changes to detect array moves. Returns ordered actions that preserve
    // the original change order. Only run full reconciliation when a model is both
    // removed AND re-added (indicating a move/reorder).
    const actions = analyzeChanges(changesToApply)

    for (const action of actions) {
      switch (action.type) {
        case "applyDirectly":
          // Apply change directly (works for both array and non-array changes)
          applyMobxChangeToLoroObject(action.change, loroObject)
          break

        case "reconcileArray": {
          // Array changes with moves: need to reconcile to preserve container identity
          const resolved = resolvePath(boundObject, action.path)
          const mobxArray = resolved.value as unknown[]
          const loroList = resolveLoroPath(loroObject, action.path) as LoroMovableList

          reconcileLoroMovableList(loroList, mobxArray)
          break
        }
      }
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
