import { remove } from "mobx"
import type { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { isReservedModelKey, modelIdKey, modelTypeKey } from "../model/metadata"
import { getSnapshotModelType, isModel } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName, getModelNotRegisteredErrorMessage } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import {
  type AnyModelProp,
  getModelPropStoredDefaultValue,
  noDefaultValue,
} from "../modelShared/prop"
import { deepEquals } from "../treeUtils/deepEquals"
import {
  isTypeCheckingAfterChangeEnabled,
  runTypeCheckingAfterChange,
} from "../tweaker/typeChecking"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { isArray } from "../utils"
import { withErrorModelTrailEntry, withErrorPathSegment } from "../utils/errorDiagnostics"
import type { ModelPool } from "../utils/ModelPool"
import { setIfDifferent } from "../utils/setIfDifferent"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { flushInternalSnapshot, getInternalSnapshot } from "./internal"
import { detachIfNeeded, reconcileSnapshot, registerReconciler } from "./reconcileSnapshot"
import type { SnapshotInOfModel } from "./SnapshotOf"
import { SnapshotProcessingError } from "./SnapshotProcessingError"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function reconcileModelSnapshot(
  value: any,
  sn: SnapshotInOfModel<AnyModel>,
  modelPool: ModelPool,
  parent: any
): AnyModel {
  const type = sn[modelTypeKey]!

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw new SnapshotProcessingError({
      message: getModelNotRegisteredErrorMessage(type),
      actualSnapshot: sn,
    })
  }

  const modelClass = modelInfo.class as ModelClass<AnyModel>

  // Snapshot processors are pure, deterministic, and required to round-trip
  // the canonical output snapshot. A successful canonical no-op therefore
  // cannot produce a diagnostic, so keep this hottest path outside the
  // model-trail bookkeeping and defer id metadata until needed. The
  // positional value was already flushed by the getSnapshot call in
  // reconcileSnapshot, so its transformed snapshot is current.
  if (isCanonicalSnapshotNoOp(value, type, sn)) {
    return value
  }

  const modelIdPropertyName = getModelIdPropertyName(modelClass)
  const incomingModelId = modelIdPropertyName ? sn[modelIdPropertyName] : undefined
  const positionalModelMatches =
    isModel(value) &&
    value[modelTypeKey] === type &&
    (!modelIdPropertyName || value[modelIdKey] === incomingModelId)

  // The positional model is already the desired instance in the common
  // stable-update case. Only moved identified models need a pool lookup.
  if (!positionalModelMatches && modelIdPropertyName) {
    const modelInPool = modelPool.findModelByTypeAndId(type, incomingModelId)
    if (modelInPool) {
      value = modelInPool

      // A pool model may carry snapshot updates still pending propagation from
      // earlier mutations in the same action, so flush before comparing.
      flushInternalSnapshot(modelInPool, false)

      // Repeat the canonical comparison so moved models can also avoid
      // processor and property-by-property reconciliation.
      if (isCanonicalSnapshotNoOp(modelInPool, type, sn)) {
        return modelInPool
      }
    }
  }

  const trailModelId = typeof incomingModelId === "string" ? incomingModelId : undefined
  return withErrorModelTrailEntry(type, trailModelId, () => {
    // we don't check by actual instance since the class might be a different one due to hot reloading
    if (!isModel(value) || value[modelTypeKey] !== type) {
      // different kind of model type, no reconciliation possible
      return fromSnapshot<AnyModel>(sn)
    }

    const modelProps = getInternalModelClassPropsInfo(modelClass)
    if (modelIdPropertyName) {
      if (value[modelIdKey] !== incomingModelId) {
        // different id, no reconciliation possible
        return fromSnapshot<AnyModel>(sn)
      }
    } else if (isArray(parent)) {
      // no id and inside an array? no reconciliation possible,
      // unless the snapshots are equivalent (note deep equals will use the snapshot of value auto)
      if (!deepEquals(value, sn)) {
        return fromSnapshot<AnyModel>(sn)
      }
    }

    const modelObj: AnyModel = value
    const typeCheckingAfterChangeEnabled = isTypeCheckingAfterChangeEnabled()
    const actualModelClass = (modelObj as any).constructor as ModelClass<AnyModel>
    const fromSnapshotProcessor = actualModelClass.fromSnapshotProcessor
    const snapshotBeforeChanges = typeCheckingAfterChangeEnabled ? getSnapshot(modelObj) : undefined

    withoutTypeChecking(() => {
      const processedSn = fromSnapshotProcessor ? fromSnapshotProcessor(sn) : sn

      // Non-canonical inputs still run the input processor. Once converted to
      // the model's stored shape, avoid reconciliation when that shape is
      // already current. Comparing against the untransformed snapshot is
      // essential because an output processor may have changed its shape.
      if (fromSnapshotProcessor) {
        if (!snapshotBeforeChanges) {
          flushInternalSnapshot(modelObj, false)
        }
        if (snapshotSlotsAreEqual(getInternalSnapshot(modelObj)!.untransformed, processedSn)) {
          return
        }
      }

      const data = modelObj.$

      // remove excess props
      const dataKeys = Object.keys(data)
      const dataKeysLen = dataKeys.length
      for (let i = 0; i < dataKeysLen; i++) {
        const k = dataKeys[i]
        if (!(k in processedSn)) {
          // use default value if applicable
          const modelProp = modelProps[k] as AnyModelProp | undefined
          const defaultValue = modelProp
            ? getModelPropStoredDefaultValue(modelProp, modelObj, k)
            : noDefaultValue
          if (defaultValue === noDefaultValue) {
            remove(data, k)
          } else {
            setIfDifferent(data, k, defaultValue)
          }
        }
      }

      // reconcile the rest
      const processedSnKeys = Object.keys(processedSn)
      const processedSnKeysLen = processedSnKeys.length
      for (let i = 0; i < processedSnKeysLen; i++) {
        const k = processedSnKeys[i]
        if (!isReservedModelKey(k)) {
          const v = processedSn[k]

          const oldValue = data[k]
          let newValue = withErrorPathSegment(k, () =>
            reconcileSnapshot(oldValue, v, modelPool, modelObj)
          )

          // use default value if applicable
          if (newValue == null) {
            const modelProp = modelProps[k] as AnyModelProp | undefined
            const defaultValue = modelProp
              ? getModelPropStoredDefaultValue(modelProp, modelObj, k)
              : noDefaultValue
            if (defaultValue !== noDefaultValue) {
              newValue = defaultValue
            }
          }

          detachIfNeeded(newValue, oldValue, modelPool)

          setIfDifferent(data, k, newValue)
        }
      }
    })

    if (typeCheckingAfterChangeEnabled) {
      runTypeCheckingAfterChange(modelObj, undefined, snapshotBeforeChanges)
    }

    return modelObj
  })
}

function isCanonicalSnapshotNoOp(value: any, type: string, sn: any): boolean {
  return (
    isModel(value) &&
    value[modelTypeKey] === type &&
    snapshotSlotsAreEqual(getInternalSnapshot(value)!.transformed, sn)
  )
}

function snapshotSlotsAreEqual(
  currentSnapshot: Record<string, unknown>,
  incomingSnapshot: any
): boolean {
  const currentKeys = Object.keys(currentSnapshot)
  const incomingKeys = Object.keys(incomingSnapshot)
  if (currentKeys.length !== incomingKeys.length) {
    return false
  }

  for (let i = 0; i < currentKeys.length; i++) {
    const key = currentKeys[i]
    // a matching key at the same index proves the key is an own property of
    // the incoming snapshot without an Object.hasOwn call; canonical snapshots
    // keep key order, so the fallback is rare (never trust inherited values,
    // e.g. a crafted __proto__ chain, without an own-property proof)
    if (incomingKeys[i] !== key && !Object.hasOwn(incomingSnapshot, key)) {
      return false
    }
    if (currentSnapshot[key] !== incomingSnapshot[key]) {
      return false
    }
  }

  return true
}

/**
 * @internal
 */
export function registerModelSnapshotReconciler() {
  registerReconciler(SnapshotterAndReconcilerPriority.Model, (value, sn, modelPool, parent) => {
    if (getSnapshotModelType(sn) !== undefined) {
      return reconcileModelSnapshot(value, sn, modelPool, parent)
    }
    return undefined
  })
}
