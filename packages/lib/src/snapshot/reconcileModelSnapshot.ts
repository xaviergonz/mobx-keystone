import { remove, set } from "mobx"
import type { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { isReservedModelKey, modelIdKey, modelTypeKey } from "../model/metadata"
import { isModel, isModelSnapshot } from "../model/utils"
import { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { failure } from "../utils"
import type { ModelPool } from "../utils/ModelPool"
import { fromSnapshot } from "./fromSnapshot"
import { detachIfNeeded, reconcileSnapshot, registerReconciler } from "./reconcileSnapshot"
import type { SnapshotInOfModel } from "./SnapshotOf"

function reconcileModelSnapshot(
  value: any,
  sn: SnapshotInOfModel<AnyModel>,
  modelPool: ModelPool
): AnyModel {
  const type = sn[modelTypeKey]

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)
  const id = sn[modelIdPropertyName]

  // try to use model from pool if possible
  const modelInPool = modelPool.findModelForSnapshot(sn)
  if (modelInPool) {
    value = modelInPool
  }

  // we don't check by actual instance since the class might be a different one due to hot reloading
  if (!isModel(value) || value[modelTypeKey] !== type || value[modelIdKey] !== id) {
    // different kind of model / model instance, no reconciliation possible
    return fromSnapshot<AnyModel>(sn)
  }

  const modelObj: AnyModel = value
  let processedSn: any = sn
  if (modelObj.fromSnapshot) {
    processedSn = modelObj.fromSnapshot(sn)
  }

  const data = modelObj.$

  // remove excess props
  const dataKeys = Object.keys(data)
  const dataKeysLen = dataKeys.length
  for (let i = 0; i < dataKeysLen; i++) {
    const k = dataKeys[i]
    if (!(k in processedSn)) {
      remove(data, k)
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
      const newValue = reconcileSnapshot(oldValue, v, modelPool)

      detachIfNeeded(newValue, oldValue, modelPool)

      set(data, k, newValue)
    }
  }

  return modelObj
}

registerReconciler(3, (value, sn, modelPool) => {
  if (isModelSnapshot(sn)) {
    return reconcileModelSnapshot(value, sn, modelPool)
  }
  return undefined
})
