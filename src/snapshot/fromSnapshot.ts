import { isObservableArray, isObservableMap, isObservableSet } from "mobx"
import { DeepPartial } from "ts-essentials"
import { typeofKey } from "./metadata"
import { getModelInfoForName } from "../model/modelInfo"
import { SnapshotInOf } from "./SnapshotOf"
import { isPlainObject, isObject, failure } from "../utils"
import { runUnprotected } from "../action"
import { Model } from "../model/Model"

export function fromSnapshot<T>(sn: T extends object ? DeepPartial<SnapshotInOf<T>> : T): T {
  if (!isObject(sn)) {
    return sn as any
  }

  if (sn instanceof Map || isObservableMap(sn)) {
    throw failure("a snapshot might not contain maps")
  }

  if (sn instanceof Set || isObservableSet(sn)) {
    throw failure("a snapshot might not contain sets")
  }

  if (Array.isArray(sn) || isObservableArray(sn)) {
    return sn.map(v => fromSnapshot(v)) as any
  }

  const type = (sn as any)[typeofKey]
  if (type) {
    // a model
    const modelInfo = getModelInfoForName(type)
    if (!modelInfo) {
      throw failure(`model with name "${type}" not found in the registry`)
    }

    const modelObj: Model = new (modelInfo.class as any)()
    let processedSn = sn
    if (modelObj.fromSnapshot) {
      processedSn = modelObj.fromSnapshot(sn) as any
    }

    const data = modelObj.data as any
    runUnprotected(() => {
      for (const [k, v] of Object.entries(processedSn)) {
        if (k !== typeofKey) {
          data[k] = fromSnapshot(v)
        }
      }
    })

    return modelObj as any
  }

  if (isPlainObject(sn)) {
    // plain obj
    const plainObj: any = {}
    for (const [k, v] of Object.entries(sn)) {
      plainObj[k] = fromSnapshot(v)
    }
    return plainObj
  }

  throw failure(`unsupported snapshot - ${sn}`)
}
