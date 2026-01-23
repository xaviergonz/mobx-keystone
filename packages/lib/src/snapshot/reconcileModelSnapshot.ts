import { remove } from "mobx"
import type { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { isReservedModelKey, modelIdKey, modelTypeKey } from "../model/metadata"
import { getSnapshotModelType, isModel } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import { AnyModelProp, getModelPropDefaultValue, noDefaultValue } from "../modelShared/prop"
import { deepEquals } from "../treeUtils/deepEquals"
import { runTypeCheckingAfterChange } from "../tweaker/typeChecking"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { failure, isArray } from "../utils"
import type { ModelPool } from "../utils/ModelPool"
import { setIfDifferent } from "../utils/setIfDifferent"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { detachIfNeeded, reconcileSnapshot, registerReconciler } from "./reconcileSnapshot"
import type { SnapshotInOfModel } from "./SnapshotOf"
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
    throw failure(`model with name "${type}" not found in the registry`)
  }

  // try to use model from pool if possible
  const modelInPool = modelPool.findModelForSnapshot(sn)
  if (modelInPool) {
    value = modelInPool
  }

  // we don't check by actual instance since the class might be a different one due to hot reloading
  if (!isModel(value) || value[modelTypeKey] !== type) {
    // different kind of model type, no reconciliation possible
    return fromSnapshot<AnyModel>(sn)
  }

  const modelClass = modelInfo.class as ModelClass<AnyModel>
  const modelProps = getInternalModelClassPropsInfo(modelClass)
  const modelIdPropertyName = getModelIdPropertyName(modelClass)

  if (modelIdPropertyName) {
    const id = sn[modelIdPropertyName]

    if (value[modelIdKey] !== id) {
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
  const snapshotBeforeChanges = getSnapshot(modelObj)

  withoutTypeChecking(() => {
    const modelClass: ModelClass<AnyModel> = (modelObj as any).constructor
    const processedSn = modelClass.fromSnapshotProcessor ? modelClass.fromSnapshotProcessor(sn) : sn

    const data = modelObj.$

    // remove excess props
    const dataKeys = Object.keys(data)
    const dataKeysLen = dataKeys.length
    for (let i = 0; i < dataKeysLen; i++) {
      const k = dataKeys[i]
      if (!(k in processedSn)) {
        // use default value if applicable
        const modelProp = modelProps[k] as AnyModelProp | undefined
        const defaultValue = modelProp ? getModelPropDefaultValue(modelProp) : noDefaultValue
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
        let newValue = reconcileSnapshot(oldValue, v, modelPool, modelObj)

        // use default value if applicable
        if (newValue == null) {
          const modelProp = modelProps[k] as AnyModelProp | undefined
          const defaultValue = modelProp ? getModelPropDefaultValue(modelProp) : noDefaultValue
          if (defaultValue !== noDefaultValue) {
            newValue = defaultValue
          }
        }

        detachIfNeeded(newValue, oldValue, modelPool)

        setIfDifferent(data, k, newValue)
      }
    }
  })

  runTypeCheckingAfterChange(modelObj, undefined, snapshotBeforeChanges)

  return modelObj
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
