import { type LoroDoc, type LoroEventBatch, LoroMovableList } from "loro-crdt"
import { action } from "mobx"
import {
  AnyDataModel,
  AnyModel,
  AnyStandardType,
  applyPatches,
  fromSnapshot,
  getParentToChildPath,
  getSnapshot,
  ModelClass,
  onGlobalPatches,
  onPatches,
  onSnapshot,
  Patch,
  SnapshotOutOf,
  TypeToData,
} from "mobx-keystone"
import { nanoid } from "nanoid"
import { getOrCreateLoroCollectionAtom } from "../utils/getOrCreateLoroCollectionAtom"
import {
  type BindableLoroContainer,
  isBindableLoroContainer,
} from "../utils/isBindableLoroContainer"
import { applyMobxKeystonePatchToLoroObject } from "./applyMobxKeystonePatchToLoroObject"
import { convertLoroDataToJson } from "./convertLoroDataToJson"
import { convertLoroEventToPatches } from "./convertLoroEventToPatches"
import { type LoroBindingContext, loroBindingContext } from "./loroBindingContext"
import { detectMoves, type MoveOperation } from "./moveDetection"
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

  const initializationGlobalPatches: { target: object; patches: Patch[] }[] = []

  const createBoundObject = () => {
    const disposeOnGlobalPatches = onGlobalPatches((target, patches) => {
      initializationGlobalPatches.push({ target, patches })
    })

    try {
      const boundObject = loroBindingContext.apply(
        () => fromSnapshot(mobxKeystoneType, loroJson),
        bindingContext
      )
      loroBindingContext.set(boundObject, { ...bindingContext, boundObject })
      return boundObject
    } finally {
      disposeOnGlobalPatches()
    }
  }

  const boundObject = createBoundObject()

  // Get the container ID of the root Loro object for path resolution
  const loroContainerId = loroObject.id

  // Track previous snapshot for move detection
  let previousSnapshot = getSnapshot(boundObject)

  // bind any changes from Loro to mobx-keystone
  const loroSubscribeCb = action((eventBatch: LoroEventBatch) => {
    // Skip if the change originated from us
    if (eventBatch.origin === loroOrigin) {
      return
    }

    // Notify MobX that containers have changed (for text, map, list reactivity)
    for (const event of eventBatch.events) {
      const container = loroDoc.getContainerById(event.target)
      if (container && isBindableLoroContainer(container)) {
        getOrCreateLoroCollectionAtom(container).reportChanged()
      }
    }

    applyingLoroChangesToMobxKeystone++
    try {
      const patches: Patch[][] = eventBatch.events.map((event) =>
        convertLoroEventToPatches(event, loroDoc, loroContainerId)
      )

      if (patches.length > 0) {
        applyPatches(boundObject, patches)
      }

      previousSnapshot = getSnapshot(boundObject)
    } finally {
      applyingLoroChangesToMobxKeystone--
    }
  })

  const loroUnsubscribe = loroDoc.subscribe(loroSubscribeCb)

  // bind any changes from mobx-keystone to Loro
  let pendingArrayOfArrayOfPatches: Patch[][] = []
  const disposeOnPatches = onPatches(boundObject, (patches) => {
    if (applyingLoroChangesToMobxKeystone > 0) {
      return
    }

    pendingArrayOfArrayOfPatches.push(patches)
  })

  // this is only used so we can batch all patches to the snapshot boundary
  const disposeOnSnapshot = onSnapshot(boundObject, () => {
    if (pendingArrayOfArrayOfPatches.length === 0) {
      return
    }

    const arrayOfArrayOfPatches = pendingArrayOfArrayOfPatches
    pendingArrayOfArrayOfPatches = []

    // Get current snapshot for move detection
    const currentSnapshot = getSnapshot(boundObject)

    // Flatten patches for move detection
    const allPatches = arrayOfArrayOfPatches.flat()

    // Detect moves in array patches
    const { regularPatches, moveOperations } = detectMoves(
      allPatches,
      previousSnapshot,
      currentSnapshot
    )

    loroDoc.setNextCommitOrigin(loroOrigin)

    // Apply regular patches first (to create/populate arrays)
    // This ensures arrays and their items exist before move operations are applied
    for (const patch of regularPatches) {
      applyMobxKeystonePatchToLoroObject(loroObject, patch)
    }

    // Apply move operations after (using native Loro move)
    // At this point, the arrays and items are guaranteed to exist
    for (const move of moveOperations) {
      applyMoveToLoro(loroObject, move)
    }

    // Commit the changes
    loroDoc.commit()

    previousSnapshot = currentSnapshot
  })

  // sync initial patches, that might include setting defaults, IDs, etc
  loroDoc.setNextCommitOrigin(loroOrigin)

  // we need to skip initializations until we hit the initialization of the bound object
  // this is because default objects might be created and initialized before the main object
  // but we just need to catch when those are actually assigned to the bound object
  let boundObjectFound = false

  for (const { target, patches } of initializationGlobalPatches) {
    if (!boundObjectFound) {
      if (target !== boundObject) {
        continue // skip
      }
      boundObjectFound = true
    }

    const parentToChildPath = getParentToChildPath(boundObject, target)
    // this is undefined only if target is not a child of boundModel
    if (parentToChildPath !== undefined) {
      for (const patch of patches) {
        applyMobxKeystonePatchToLoroObject(loroObject, {
          ...patch,
          path: [...parentToChildPath, ...patch.path],
        })
      }
    }
  }

  loroDoc.commit()

  // Update previous snapshot after initial sync
  previousSnapshot = getSnapshot(boundObject)

  const dispose = () => {
    loroUnsubscribe()
    disposeOnPatches()
    disposeOnSnapshot()
  }

  return {
    boundObject,
    dispose,
    loroOrigin,
  }
}

/**
 * Applies a move operation to a Loro document.
 */
function applyMoveToLoro(loroObject: BindableLoroContainer, move: MoveOperation): void {
  const parent = move.path.length === 0 ? loroObject : resolveLoroPath(loroObject, move.path)

  if (parent instanceof LoroMovableList) {
    if (move.fromIndex >= 0 && move.fromIndex < parent.length) {
      parent.move(move.fromIndex, move.toIndex)
    }
  }
}
