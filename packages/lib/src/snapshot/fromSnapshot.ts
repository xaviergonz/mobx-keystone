import { action, observable, set } from "mobx"
import { frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { AnyModel } from "../model/BaseModel"
import { isReservedModelKey, modelTypeKey } from "../model/metadata"
import { getModelInfoForName } from "../model/modelInfo"
import { isModelSnapshot } from "../model/utils"
import { tweakArray } from "../tweaker/tweakArray"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, isArray, isMap, isPlainObject, isPrimitive, isSet } from "../utils"
import {
  SnapshotInOf,
  SnapshotInOfArray,
  SnapshotInOfModel,
  SnapshotInOfObject,
  SnapshotOutOf,
} from "./SnapshotOf"

/**
 * Deserializers a data structure from its snapshot form.
 *
 * @typeparam T Object type.
 * @param snapshot Snapshot, even if a primitive.
 * @returns The deserialized object.
 */
export let fromSnapshot = <T>(snapshot: SnapshotInOf<T> | SnapshotOutOf<T>): T => {
  return internalFromSnapshot<T>(snapshot)
}
fromSnapshot = action("fromSnapshot", fromSnapshot) as any

function internalFromSnapshot<T>(sn: SnapshotInOf<T> | SnapshotOutOf<T>): T {
  if (isPrimitive(sn)) {
    return sn as any
  }

  if (isMap(sn)) {
    throw failure("a snapshot might not contain maps")
  }

  if (isSet(sn)) {
    throw failure("a snapshot might not contain sets")
  }

  if (isArray(sn)) {
    return fromArraySnapshot(sn) as any
  }

  if (isFrozenSnapshot(sn)) {
    return frozen(sn.data) as any
  }

  if (isModelSnapshot(sn)) {
    return fromModelSnapshot(sn) as any
  }

  if (isPlainObject(sn)) {
    return fromPlainObjectSnapshot(sn) as any
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function fromArraySnapshot(sn: SnapshotInOfArray<any>): any[] {
  const arr = observable.array([] as any[], observableOptions)
  const ln = sn.length
  for (let i = 0; i < ln; i++) {
    arr.push(internalFromSnapshot(sn[i]))
  }
  return tweakArray(arr, undefined, true)
}

function fromModelSnapshot(sn: SnapshotInOfModel<AnyModel>): AnyModel {
  const type = sn[modelTypeKey]

  if (!type) {
    throw failure(
      `a model a snapshot must contain a type key (${modelTypeKey}), but none was found`
    )
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  return new (modelInfo.class as any)(undefined, {
    unprocessedSnapshot: sn,
    snapshotToInitialData,
  })
}

function snapshotToInitialData(processedSn: SnapshotInOfModel<AnyModel>): any {
  const initialData = observable.object({} as any, undefined, observableOptions)

  const processedSnKeys = Object.keys(processedSn)
  const processedSnKeysLen = processedSnKeys.length
  for (let i = 0; i < processedSnKeysLen; i++) {
    const k = processedSnKeys[i]
    if (!isReservedModelKey(k)) {
      const v = processedSn[k]
      set(initialData, k, internalFromSnapshot(v))
    }
  }
  return initialData
}

function fromPlainObjectSnapshot(sn: SnapshotInOfObject<any>): object {
  const plainObj = observable.object({} as any, undefined, observableOptions)

  const snKeys = Object.keys(sn)
  const snKeysLen = snKeys.length
  for (let i = 0; i < snKeysLen; i++) {
    const k = snKeys[i]
    const v = sn[k]
    set(plainObj, k, internalFromSnapshot(v))
  }
  return tweakPlainObject(plainObj, undefined, undefined, true, false)
}

const observableOptions = {
  deep: false,
}
