import { isObservableObject } from "mobx"
import { BuiltInAction } from "../action/builtInActions"
import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { isFrozenSnapshot } from "../frozen/Frozen"
import type { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { modelIdKey, modelTypeKey } from "../model/metadata"
import { getSnapshotModelType, isModel } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import {
  getModelInfoForName,
  getModelNotRegisteredErrorMessage,
  modelInfoByClass,
} from "../modelShared/modelInfo"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsObject, inDevMode, isArray, isMap, isPlainObject, isSet, lazy } from "../utils"
import {
  runWithErrorDiagnosticsContext,
} from "../utils/errorDiagnostics"
import { ModelPool } from "../utils/ModelPool"
import { reconcileSnapshot } from "./reconcileSnapshot"
import type { SnapshotInOf, SnapshotOutOf } from "./SnapshotOf"
import { SnapshotProcessingError } from "./SnapshotProcessingError"

/**
 * Applies a full snapshot over an object, reconciling it with the current contents of the object.
 *
 * @template T Object type.
 * @param node Target object (model object, object or array).
 * @param snapshot Snapshot to apply.
 */
export function applySnapshot<T extends object>(
  node: T,
  snapshot: SnapshotInOf<T> | SnapshotOutOf<T>
): void

export function applySnapshot(node: object, snapshot: unknown): void {
  assertTweakedObject(node, "node")
  assertIsObject(snapshot, "snapshot")

  runWithErrorDiagnosticsContext(() => {
    wrappedInternalApplySnapshot().call(node, snapshot)
  })
}

/**
 * @internal
 */
export function internalApplySnapshot<T extends object>(
  this: T,
  sn: SnapshotInOf<T> | SnapshotOutOf<T>
): void {
  const obj = this

  const reconcile = () => {
    const modelPool = new ModelPool(obj)
    const ret = reconcileSnapshot(obj, sn, modelPool, undefined)

    if (inDevMode) {
      if (ret !== obj) {
        throw new SnapshotProcessingError({
          message: "assertion failed: reconciled object has to be the same",
          actualSnapshot: sn,
        })
      }
    }
  }

  if (isArray(sn)) {
    if (!isArray(obj)) {
      throw new SnapshotProcessingError({
        message: "if the snapshot is an array the target must be an array too",
        actualSnapshot: sn,
      })
    }

    reconcile()
    return
  }

  if (isFrozenSnapshot(sn)) {
    throw new SnapshotProcessingError({
      message: "applySnapshot cannot be used over frozen objects",
      actualSnapshot: sn,
    })
  }

  // adapt snapshot to target model if possible
  if (isPlainObject(sn) && (sn as any)[modelTypeKey] === undefined && isModel(obj)) {
    const modelInfo = modelInfoByClass.get((obj as any).constructor)!
    sn = { ...sn, [modelTypeKey]: modelInfo.name }
  }

  const modelType = getSnapshotModelType(sn)
  if (modelType !== undefined) {
    const modelInfo = getModelInfoForName(modelType)
    if (!modelInfo) {
      throw new SnapshotProcessingError({
        message: getModelNotRegisteredErrorMessage(modelType),
        actualSnapshot: sn,
      })
    }

    // we don't check by actual instance since the class might be a different one due to hot reloading
    if (!isModel(obj)) {
      // not a model instance, no reconciliation possible
      throw new SnapshotProcessingError({
        message: "the target for a model snapshot must be a model instance",
        actualSnapshot: sn,
      })
    }

    if (obj[modelTypeKey] !== modelType) {
      // different kind of model, no reconciliation possible
      throw new SnapshotProcessingError({
        message: `snapshot model type '${modelType}' does not match target model type '${
          (obj as any)[modelTypeKey]
        }'`,
        actualSnapshot: sn,
      })
    }

    const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)
    if (modelIdPropertyName) {
      const id = (sn as any)[modelIdPropertyName]
      if (obj[modelIdKey] !== id) {
        // different id, no reconciliation possible
        throw new SnapshotProcessingError({
          message: `snapshot model id '${id}' does not match target model id '${
            obj[modelIdKey]
          }'`,
          actualSnapshot: sn,
        })
      }
    }

    reconcile()
    return
  }

  if (isPlainObject(sn)) {
    if (!(isPlainObject(obj) || isObservableObject(obj))) {
      // no reconciliation possible
      throw new SnapshotProcessingError({
        message: "if the snapshot is an object the target must be an object too",
        actualSnapshot: sn,
      })
    }

    reconcile()
    return
  }

  if (isMap(sn)) {
    throw new SnapshotProcessingError({
      message: "a snapshot must not contain maps",
      actualSnapshot: sn,
    })
  }

  if (isSet(sn)) {
    throw new SnapshotProcessingError({
      message: "a snapshot must not contain sets",
      actualSnapshot: sn,
    })
  }

  throw new SnapshotProcessingError({
    message: "unsupported snapshot",
    actualSnapshot: sn,
  })
}

const wrappedInternalApplySnapshot = lazy(() =>
  wrapInAction({
    nameOrNameFn: BuiltInAction.ApplySnapshot,
    fn: internalApplySnapshot,
    actionType: ActionContextActionType.Sync,
  })
)
