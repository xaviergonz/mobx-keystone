import { isObservableObject, remove, set } from "mobx"
import { Frozen, frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { AnyModel } from "../model/BaseModel"
import { isReservedModelKey, modelIdKey, modelTypeKey } from "../model/metadata"
import { getModelInfoForName } from "../model/modelInfo"
import { isModel, isModelSnapshot } from "../model/utils"
import { fastGetParentPathIncludingDataObjects } from "../parent"
import { failure, isArray, isMap, isPlainObject, isPrimitive, isSet } from "../utils"
import { ModelPool } from "../utils/ModelPool"
import { fromSnapshot } from "./fromSnapshot"
import { SnapshotInOfFrozen, SnapshotInOfModel, SnapshotInOfObject } from "./SnapshotOf"

/**
 * @ignore
 */
export function reconcileSnapshot(value: any, sn: any, modelPool: ModelPool): any {
  if (isPrimitive(sn)) {
    return sn
  }

  if (isArray(sn)) {
    return reconcileArraySnapshot(value, sn, modelPool)
  }

  if (isFrozenSnapshot(sn)) {
    return reconcileFrozenSnapshot(value, sn)
  }

  if (isModelSnapshot(sn)) {
    return reconcileModelSnapshot(value, sn, modelPool)
  }

  if (isPlainObject(sn)) {
    return reconcilePlainObjectSnapshot(value, sn, modelPool)
  }

  if (isMap(sn)) {
    throw failure("a snapshot must not contain maps")
  }

  if (isSet(sn)) {
    throw failure("a snapshot must not contain sets")
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function reconcileArraySnapshot(
  value: any,
  sn: SnapshotInOfObject<any[]>,
  modelPool: ModelPool
): any[] {
  if (!isArray(value)) {
    // no reconciliation possible
    return fromSnapshot(sn)
  }

  // remove excess items
  if (value.length > sn.length) {
    value.splice(sn.length, value.length - sn.length)
  }

  // reconcile present items
  for (let i = 0; i < value.length; i++) {
    const oldValue = value[i]
    const newValue = reconcileSnapshot(oldValue, sn[i], modelPool)

    detachIfNeeded(newValue, oldValue, modelPool)

    set(value, i as any, newValue)
  }

  // add excess items
  for (let i = value.length; i < sn.length; i++) {
    value.push(reconcileSnapshot(undefined, sn[i], modelPool))
  }

  return value
}

function reconcileFrozenSnapshot(value: any, sn: SnapshotInOfFrozen<Frozen<any>>): Frozen<any> {
  // reconciliation is only possible if the target is a Frozen instance with the same data (by ref)
  // in theory we could compare the JSON representation of both datas or do a deep comparison, but that'd be too slow
  if (value instanceof Frozen && value.data === sn.data) {
    return value
  }
  return frozen(sn.data)
}

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

  const id = sn[modelIdKey]

  // try to use model from pool if possible
  const modelInPool = modelPool.findModelForSnapshot(sn)
  if (modelInPool) {
    value = modelInPool
  }

  if (
    !(value instanceof modelInfo.class) ||
    value[modelTypeKey] !== type ||
    value[modelIdKey] !== id
  ) {
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

function reconcilePlainObjectSnapshot(
  value: any,
  sn: SnapshotInOfObject<any>,
  modelPool: ModelPool
): object {
  // plain obj
  if (!isPlainObject(value) && !isObservableObject(value)) {
    // no reconciliation possible
    return fromSnapshot(sn)
  }

  const plainObj = value

  // remove excess props
  const plainObjKeys = Object.keys(plainObj)
  const plainObjKeysLen = plainObjKeys.length
  for (let i = 0; i < plainObjKeysLen; i++) {
    const k = plainObjKeys[i]
    if (!(k in sn)) {
      remove(plainObj, k)
    }
  }

  // reconcile the rest
  const snKeys = Object.keys(sn)
  const snKeysLen = snKeys.length
  for (let i = 0; i < snKeysLen; i++) {
    const k = snKeys[i]
    const v = sn[k]

    const oldValue = plainObj[k]
    const newValue = reconcileSnapshot(oldValue, v, modelPool)

    detachIfNeeded(newValue, oldValue, modelPool)

    set(plainObj, k, newValue)
  }

  return plainObj
}

function detachIfNeeded(newValue: any, oldValue: any, modelPool: ModelPool) {
  // edge case for when we are swapping models around the tree

  if (newValue === oldValue) {
    // already where it should be
    return
  }

  if (isModel(newValue) && modelPool.findModelByTypeAndId(newValue.$modelType, newValue.$modelId)) {
    const parentPath = fastGetParentPathIncludingDataObjects(newValue)
    if (parentPath) {
      set(parentPath.parent, parentPath.path, null)
    }
  }
}
