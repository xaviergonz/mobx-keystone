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
import { applyMobxKeystonePatchToYjsObject } from "./applyMobxKeystonePatchToYjsObject"
import { convertYjsEventToPatches } from "./convertYjsEventToPatches"

export function bindYjsToMobxKeystone<
  TType extends AnyStandardType | ModelClass<AnyModel> | ModelClass<AnyDataModel>,
>({
  yjsDoc,
  yjsObject,
  mobxKeystoneType,
}: {
  yjsDoc: Y.Doc
  yjsObject: Y.Map<unknown> | Y.Array<unknown>
  mobxKeystoneType: TType
}): { boundObject: TypeToData<TType>; dispose(): void } {
  const yjsJson = yjsObject.toJSON()

  const initializationGlobalPatches: { target: object; patches: Patch[] }[] = []

  const createBoundObject = () => {
    const disposeOnGlobalPatches = onGlobalPatches((target, patches) => {
      initializationGlobalPatches.push({ target, patches })
    })

    try {
      return fromSnapshot(mobxKeystoneType, yjsJson as any)
    } finally {
      disposeOnGlobalPatches()
    }
  }

  const boundObject = createBoundObject()

  let applyingYjsChanges = 0
  let applyingMobxKeystoneChanges = 0

  // bind any changes from yjs to mobx-keystone
  const observeDeepCb = (events: Y.YEvent<any>[]) => {
    if (applyingYjsChanges > 0) {
      return
    }

    const patches: Patch[] = []
    events.forEach((event) => {
      patches.push(...convertYjsEventToPatches(event))
    })

    applyingMobxKeystoneChanges++
    try {
      applyPatches(boundObject, patches)
    } finally {
      applyingMobxKeystoneChanges--
    }
  }

  yjsObject.observeDeep(observeDeepCb)

  // bind any changes from mobx-keystone to yjs
  let pendingPatches: Patch[] = []
  const disposeOnPatches = onPatches(boundObject, (patches) => {
    pendingPatches.push(...patches)
  })

  // this is only used so we can transact all patches to the snapshot boundary
  const disposeOnSnapshot = onSnapshot(boundObject, () => {
    if (applyingMobxKeystoneChanges > 0) {
      return
    }

    const patches = pendingPatches
    pendingPatches = []

    applyingYjsChanges++
    try {
      yjsDoc.transact(() => {
        patches.forEach((patch) => {
          applyMobxKeystonePatchToYjsObject(patch, yjsObject)
        })
      })
    } finally {
      applyingYjsChanges--
    }
  })

  // sync initial patches, that might include setting defaults, IDs, etc
  applyingYjsChanges++
  try {
    yjsDoc.transact(() => {
      initializationGlobalPatches.forEach(({ target, patches }) => {
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
    })
  } finally {
    applyingYjsChanges--
  }

  return {
    boundObject,
    dispose: () => {
      disposeOnPatches()
      disposeOnSnapshot()
      yjsObject.unobserveDeep(observeDeepCb)
    },
  }
}
