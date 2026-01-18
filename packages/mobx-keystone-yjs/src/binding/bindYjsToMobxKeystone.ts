import { action } from "mobx"
import {
  AnyDataModel,
  AnyModel,
  AnyStandardType,
  DeepChange,
  fromSnapshot,
  getParentToChildPath,
  getSnapshot,
  ModelClass,
  onDeepChange,
  onGlobalDeepChange,
  onSnapshot,
  SnapshotInOf,
  TypeToData,
} from "mobx-keystone"
import * as Y from "yjs"
import type { PlainArray, PlainObject } from "../plainTypes"
import { failure } from "../utils/error"
import { getYjsCollectionAtom } from "../utils/getOrCreateYjsCollectionAtom"
import { isYjsValueDeleted } from "../utils/isYjsValueDeleted"
import { applyMobxChangeToYjsObject } from "./applyMobxChangeToYjsObject"
import { applyYjsEventToMobx, ReconciliationMap } from "./applyYjsEventToMobx"
import { applyJsonArrayToYArray, applyJsonObjectToYMap } from "./convertJsonToYjsData"
import { convertYjsDataToJson } from "./convertYjsDataToJson"
import { YjsBindingContext, yjsBindingContext } from "./yjsBindingContext"
import { setYjsContainerSnapshot } from "./yjsSnapshotTracking"

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

  let boundObject: TypeToData<TType>

  // Track if any init changes occur during fromSnapshot
  // (e.g., defaults being applied, onInit hooks mutating the model)
  let hasInitChanges = false

  const createBoundObject = () => {
    // Set up a temporary global listener to detect if any init changes occur during fromSnapshot
    const disposeGlobalListener = onGlobalDeepChange((_target, change) => {
      if (change.isInit) {
        hasInitChanges = true
      }
    })

    try {
      const result = yjsBindingContext.apply(
        () => fromSnapshot(mobxKeystoneType, yjsJson as unknown as SnapshotInOf<TypeToData<TType>>),
        bindingContext
      )
      yjsBindingContext.set(result, { ...bindingContext, boundObject: result })
      return result
    } finally {
      disposeGlobalListener()
    }
  }

  boundObject = createBoundObject()

  // bind any changes from yjs to mobx-keystone
  const observeDeepCb = action((events: Y.YEvent<any>[]) => {
    const eventsToApply: Y.YEvent<any>[] = []

    events.forEach((event) => {
      if (event.transaction.origin !== yjsOrigin) {
        eventsToApply.push(event)
      }

      if (event.target instanceof Y.Map || event.target instanceof Y.Array) {
        getYjsCollectionAtom(event.target)?.reportChanged()
      }
    })

    if (eventsToApply.length > 0) {
      applyingYjsChangesToMobxKeystone++
      try {
        const reconciliationMap: ReconciliationMap = new Map()

        // Collect init changes that occur during event application
        // (e.g., fromSnapshot calls that trigger onInit hooks)
        // We store both target and change so we can compute the correct path later
        const initChanges: { target: object; change: DeepChange }[] = []
        const disposeGlobalListener = onGlobalDeepChange((target, change) => {
          if (change.isInit) {
            initChanges.push({ target, change })
          }
        })

        try {
          eventsToApply.forEach((event) => {
            applyYjsEventToMobx(event, boundObject, reconciliationMap)
          })
        } finally {
          disposeGlobalListener()
        }

        // Sync back any init-time mutations from fromSnapshot calls
        // (e.g., onInit hooks that modify the model)
        // This is needed because init changes during Yjs event handling are not
        // captured by the main onDeepChange (it skips changes when applyingYjsChangesToMobxKeystone > 0)
        if (initChanges.length > 0 && !isYjsValueDeleted(yjsObject)) {
          yjsDoc.transact(() => {
            for (const { target, change } of initChanges) {
              // Compute the path from boundObject to the target
              const pathToTarget = getParentToChildPath(boundObject, target)
              if (pathToTarget !== undefined) {
                // Create a new change with the correct path from the root
                const changeWithCorrectPath: DeepChange = {
                  ...change,
                  path: [...pathToTarget, ...change.path],
                }
                applyMobxChangeToYjsObject(changeWithCorrectPath, yjsObject)
              }
            }
          }, yjsOrigin)
        }

        // Update snapshot tracking: the Y.js container is now in sync with the current MobX snapshot
        // This enables the merge optimization to skip unchanged subtrees during reconciliation
        if (yjsObject instanceof Y.Map || yjsObject instanceof Y.Array) {
          setYjsContainerSnapshot(yjsObject, getSnapshot(boundObject))
        }
      } finally {
        applyingYjsChangesToMobxKeystone--
      }
    }
  })

  yjsObject.observeDeep(observeDeepCb)

  // bind any changes from mobx-keystone to yjs using deep change observation
  // This provides proper splice detection for array operations
  let pendingChanges: DeepChange[] = []

  const disposeOnDeepChange = onDeepChange(boundObject, (change) => {
    if (applyingYjsChangesToMobxKeystone > 0) {
      return
    }

    // Skip init changes - they are handled by the getSnapshot + merge at the end of binding
    if (change.isInit) {
      return
    }

    pendingChanges.push(change)
  })

  // this is only used so we can transact all changes to the snapshot boundary
  const disposeOnSnapshot = onSnapshot(boundObject, (boundObjectSnapshot) => {
    if (pendingChanges.length === 0) {
      return
    }

    const changesToApply = pendingChanges
    pendingChanges = []

    // Skip syncing to Yjs if the Yjs object has been deleted/detached
    if (isYjsValueDeleted(yjsObject)) {
      return
    }

    yjsDoc.transact(() => {
      changesToApply.forEach((change) => {
        applyMobxChangeToYjsObject(change, yjsObject)
      })
    }, yjsOrigin)

    // Update snapshot tracking: the Y.js container is now in sync with the current MobX snapshot
    if (yjsObject instanceof Y.Map || yjsObject instanceof Y.Array) {
      setYjsContainerSnapshot(yjsObject, boundObjectSnapshot)
    }
  })

  // Sync the init changes to the CRDT.
  // Init changes include: defaults being applied, onInit hooks mutating the model.
  // We use getSnapshot + merge because the per-change approach has issues with reference mutation
  // (values captured in DeepChange can be mutated before we apply them).
  // The snapshot tracking optimization ensures unchanged subtrees are skipped during merge.
  const finalSnapshot = getSnapshot(boundObject)

  if (hasInitChanges) {
    yjsDoc.transact(() => {
      if (yjsObject instanceof Y.Map) {
        applyJsonObjectToYMap(yjsObject, finalSnapshot as unknown as PlainObject, {
          mode: "merge",
        })
      } else if (yjsObject instanceof Y.Array) {
        applyJsonArrayToYArray(yjsObject, finalSnapshot as unknown as PlainArray, {
          mode: "merge",
        })
      }
    }, yjsOrigin)
  }

  // Always update snapshot tracking after binding initialization
  // This ensures the merge optimization can skip unchanged subtrees in future reconciliations
  if (yjsObject instanceof Y.Map || yjsObject instanceof Y.Array) {
    setYjsContainerSnapshot(yjsObject, finalSnapshot)
  }

  const dispose = () => {
    yjsDoc.off("destroy", dispose)
    disposeOnDeepChange()
    disposeOnSnapshot()
    yjsObject.unobserveDeep(observeDeepCb)
  }

  yjsDoc.on("destroy", dispose)

  return {
    boundObject,
    dispose,
    yjsOrigin,
  }
}
