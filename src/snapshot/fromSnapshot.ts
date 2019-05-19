import { isObservableArray, isObservableMap, isObservableSet } from "mobx"
import { DeepPartial } from "ts-essentials"
import { typeofKey } from "./metadata"
import { getModelInfoForName } from "../model/modelInfo"
import { SnapshotOf } from "./SnapshotOf"
import { isPlainObject, isObject, failure } from "../utils"
import { runUnprotected } from "../action"

export function fromSnapshot<T>(sn: T extends object ? DeepPartial<SnapshotOf<T>> : T): T {
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

    const modelObj = new (modelInfo.class as any)()

    runUnprotected(() => {
      for (const [k, v] of Object.entries(sn)) {
        if (k !== typeofKey) {
          modelObj.data[k] = fromSnapshot(v)
        }
      }
    })

    return modelObj
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
