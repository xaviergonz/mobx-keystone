import { isObservableObject } from "mobx"
import { Frozen, frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { isReservedModelKey, modelMetadataKey } from "../model/metadata"
import { AnyModel } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import { isModelSnapshot } from "../model/utils"
import { failure, isArray, isMap, isPlainObject, isPrimitive, isSet } from "../utils"
import { fromSnapshot } from "./fromSnapshot"
import {
  SnapshotInOfArray,
  SnapshotInOfFrozen,
  SnapshotInOfModel,
  SnapshotInOfObject,
} from "./SnapshotOf"

/**
 * @ignore
 */
export function reconcileSnapshot(value: any, sn: any): any {
  if (isPrimitive(sn)) {
    return sn
  }

  if (isMap(sn)) {
    throw failure("a snapshot might not contain maps")
  }

  if (isSet(sn)) {
    throw failure("a snapshot might not contain sets")
  }

  if (isArray(sn)) {
    return reconcileArraySnapshot(value, sn)
  }

  if (isFrozenSnapshot(sn)) {
    return reconcileFrozenSnapshot(value, sn)
  }

  if (isModelSnapshot(sn)) {
    return reconcileModelSnapshot(value, sn)
  }

  if (isPlainObject(sn)) {
    return reconcilePlainObjectSnapshot(value, sn)
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function reconcileArraySnapshot(value: any, sn: SnapshotInOfArray<any>): any[] {
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
    value[i] = reconcileSnapshot(value[i], sn[i])
  }

  // add excess items
  for (let i = value.length; i < sn.length; i++) {
    value.push(fromSnapshot(sn[i]))
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

function reconcileModelSnapshot(value: any, sn: SnapshotInOfModel<AnyModel>): AnyModel {
  const { type, id } = sn[modelMetadataKey]

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  if (!(value instanceof modelInfo.class) || value.modelType !== type || value.modelId !== id) {
    // different kind of model / model instance, no reconciliation possible
    return fromSnapshot<AnyModel>(sn)
  }

  const modelObj: AnyModel = value
  let processedSn: any = sn
  if (modelObj.fromSnapshot) {
    processedSn = modelObj.fromSnapshot(sn)
  }

  const data = modelObj.data

  // remove excess props
  const dataKeys = Object.keys(data)
  const dataKeysLen = dataKeys.length
  for (let i = 0; i < dataKeysLen; i++) {
    const k = dataKeys[i]
    if (!(k in processedSn)) {
      delete data[k]
    }
  }

  // reconcile the rest
  const processedSnKeys = Object.keys(processedSn)
  const processedSnKeysLen = processedSnKeys.length
  for (let i = 0; i < processedSnKeysLen; i++) {
    const k = processedSnKeys[i]
    if (!isReservedModelKey(k)) {
      const v = processedSn[k]

      data[k] = reconcileSnapshot(data[k], v)
    }
  }

  return modelObj
}

function reconcilePlainObjectSnapshot(value: any, sn: SnapshotInOfObject<any>): object {
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
      delete plainObj[k]
    }
  }

  // reconcile the rest
  const snKeys = Object.keys(sn)
  const snKeysLen = snKeys.length
  for (let i = 0; i < snKeysLen; i++) {
    const k = snKeys[i]
    const v = sn[k]

    plainObj[k] = reconcileSnapshot(plainObj[k], v)
  }

  return plainObj
}
