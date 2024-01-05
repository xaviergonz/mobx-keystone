import { action } from "mobx"
import {
  AnyDataModel,
  AnyModel,
  AnyStandardType,
  ModelClass,
  Patch,
  TypeToData,
  applyPatches,
  fromSnapshot,
  getParentToChildPath,
  onGlobalPatches,
  onPatches,
  onSnapshot,
} from "mobx-keystone"
import * as Y from "yjs"
import { getOrCreateYjsCollectionAtom } from "../utils/getOrCreateYjsCollectionAtom"
import { applyMobxKeystonePatchToYjsObject } from "./applyMobxKeystonePatchToYjsObject"
import { convertYjsDataToJson } from "./convertYjsDataToJson"
import { convertYjsEventToPatches } from "./convertYjsEventToPatches"
import { YjsBindingContext, yjsBindingContext } from "./yjsBindingContext"

export function bindYjsToMobxKeystone<
  TType extends AnyStandardType | ModelClass<AnyModel> | ModelClass<AnyDataModel>,
>({
  yjsDoc,
  yjsObject,
  mobxKeystoneType,
}: {
  yjsDoc: Y.Doc
  yjsObject: Y.Map<unknown> | Y.Array<unknown> | Y.Text
  mobxKeystoneType: TType
}): {
  boundObject: TypeToData<TType>
  dispose(): void
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

  const yjsJson = convertYjsDataToJson(yjsObject)

  const initializationGlobalPatches: { target: object; patches: Patch[] }[] = []

  const createBoundObject = () => {
    const disposeOnGlobalPatches = onGlobalPatches((target, patches) => {
      initializationGlobalPatches.push({ target, patches })
    })

    try {
      const boundObject = yjsBindingContext.apply(
        () => fromSnapshot(mobxKeystoneType, yjsJson as any),
        bindingContext
      )
      yjsBindingContext.set(boundObject, { ...bindingContext, boundObject })
      return boundObject
    } finally {
      disposeOnGlobalPatches()
    }
  }

  const boundObject = createBoundObject()

  // bind any changes from yjs to mobx-keystone
  const observeDeepCb = action((events: Y.YEvent<any>[]) => {
    const patches: Patch[] = []
    events.forEach((event) => {
      if (event.transaction.origin !== yjsOrigin) {
        patches.push(...convertYjsEventToPatches(event))
      }

      if (event.target instanceof Y.Map || event.target instanceof Y.Array) {
        getOrCreateYjsCollectionAtom(event.target).reportChanged()
      }
    })

    if (patches.length > 0) {
      applyingYjsChangesToMobxKeystone++
      try {
        applyPatches(boundObject, patches)
      } finally {
        applyingYjsChangesToMobxKeystone--
      }
    }
  })

  yjsObject.observeDeep(observeDeepCb)

  // bind any changes from mobx-keystone to yjs
  let pendingArrayOfArrayOfPatches: Patch[][] = []
  const disposeOnPatches = onPatches(boundObject, (patches) => {
    if (applyingYjsChangesToMobxKeystone > 0) {
      return
    }

    pendingArrayOfArrayOfPatches.push(patches)
  })

  // this is only used so we can transact all patches to the snapshot boundary
  const disposeOnSnapshot = onSnapshot(boundObject, () => {
    if (pendingArrayOfArrayOfPatches.length === 0) {
      return
    }

    const arrayOfArrayOfPatches = pendingArrayOfArrayOfPatches
    pendingArrayOfArrayOfPatches = []

    yjsDoc.transact(() => {
      arrayOfArrayOfPatches.forEach((arrayOfPatches) => {
        arrayOfPatches.forEach((patch) => {
          applyMobxKeystonePatchToYjsObject(patch, yjsObject)
        })
      })
    }, yjsOrigin)
  })

  // sync initial patches, that might include setting defaults, IDs, etc
  yjsDoc.transact(() => {
    // we need to skip initializations until we hit the initialization of the bound object
    // this is because default objects might be created and initialized before the main object
    // but we just need to catch when those are actually assigned to the bound object
    let boundObjectFound = false

    initializationGlobalPatches.forEach(({ target, patches }) => {
      if (!boundObjectFound) {
        if (target !== boundObject) {
          return // skip
        }
        boundObjectFound = true
      }

      const parentToChildPath = getParentToChildPath(boundObject, target)
      // this is undefined only if target is not a child of boundModel
      if (parentToChildPath !== undefined) {
        patches.forEach((patch) => {
          applyMobxKeystonePatchToYjsObject(
            {
              ...patch,
              path: [...parentToChildPath, ...patch.path],
            },
            yjsObject
          )
        })
      }
    })
  }, yjsOrigin)

  return {
    boundObject,
    dispose: () => {
      disposeOnPatches()
      disposeOnSnapshot()
      yjsObject.unobserveDeep(observeDeepCb)
    },
    yjsOrigin,
  }
}
