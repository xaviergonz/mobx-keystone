import { isObservableObject } from "mobx"
import { Model } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import { failure, isArray, isMap, isModelSnapshot, isObject, isPlainObject, isSet } from "../utils"
import { fromSnapshot } from "./fromSnapshot"
import { isInternalKey, modelIdKey, typeofKey } from "./metadata"

export function reconcileSnapshot(value: any, sn: any): any {
  if (!isObject(sn)) {
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

  if (isModelSnapshot(sn)) {
    return reconcileModelSnapshot(value, sn)
  }

  if (isPlainObject(sn)) {
    return reconcilePlainObjectSnapshot(value, sn)
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function reconcileArraySnapshot(value: any, sn: any[]): any[] {
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

function reconcileModelSnapshot(value: any, sn: any): Model {
  const type = sn[typeofKey]
  const id = sn[modelIdKey]

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  if (
    !(value instanceof modelInfo.class) ||
    value[typeofKey] !== type ||
    value[modelIdKey] !== id
  ) {
    // different kind of model / model instance, no reconciliation possible
    return fromSnapshot(sn)
  }

  const modelObj: Model = value
  let processedSn = sn
  if (modelObj.fromSnapshot) {
    processedSn = modelObj.fromSnapshot(sn)
  }

  if (!modelObj.data) {
    modelObj.data = {}
  }
  const data = modelObj.data as any

  // remove excess props
  const propsToRemove = Object.keys(data).filter(k => !(k in processedSn))
  propsToRemove.forEach(p => {
    delete data[p]
  })

  // reconcile the rest
  for (const [k, v] of Object.entries(processedSn)) {
    if (!isInternalKey(k)) {
      data[k] = reconcileSnapshot(data[k], v)
    }
  }

  return modelObj
}

function reconcilePlainObjectSnapshot(value: any, sn: any): object {
  // plain obj
  if (!isPlainObject(value) && !isObservableObject(value)) {
    // no reconciliation possible
    return fromSnapshot(sn)
  }

  const plainObj = value

  // remove excess props
  const propsToRemove = Object.keys(plainObj).filter(k => !(k in sn))
  propsToRemove.forEach(p => {
    delete plainObj[p]
  })

  // reconcile the rest
  for (const [k, v] of Object.entries(sn)) {
    plainObj[k] = reconcileSnapshot(plainObj[k], v)
  }

  return plainObj
}
