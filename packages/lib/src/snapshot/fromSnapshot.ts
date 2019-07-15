import { action, observable } from "mobx"
import { frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { isReservedModelKey, modelMetadataKey } from "../model/metadata"
import { AnyModel } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import { internalNewModel } from "../model/newModel"
import { isModelSnapshot } from "../model/utils"
import { tweakArray } from "../tweaker/tweakArray"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, isArray, isMap, isPlainObject, isPrimitive, isSet } from "../utils"
import { fixSnapshotIds } from "./fixSnapshotIds"
import {
  SnapshotInOf,
  SnapshotInOfArray,
  SnapshotInOfModel,
  SnapshotInOfObject,
} from "./SnapshotOf"

/**
 * Options for `fromSnapshot`.
 */
export interface FromSnapshotOptions {
  /**
   * If set to true (the default is false) then Models will have brand new IDs, and
   * references will fix their target IDs accordingly.
   */
  generateNewIds?: boolean
}

/**
 * Deserializers a data structure from its snapshot form.
 * If options has `generateNewIds` set to true (the default is false) then Models will have brand new IDs, and
 * references will fix their target IDs accordingly.
 *
 * @typeparam T Object type.
 * @param sn Snapshot, including primitives.
 * @param [options] Options.
 * @returns The deserialized object.
 */
export let fromSnapshot = <T>(sn: SnapshotInOf<T>, options?: FromSnapshotOptions): T => {
  if (options && options.generateNewIds) {
    sn = fixSnapshotIds(sn)
  }

  return internalFromSnapshot(sn)
}
fromSnapshot = action("fromSnapshot", fromSnapshot) as any

function internalFromSnapshot<T>(sn: SnapshotInOf<T>): T {
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
  const { type, id } = sn[modelMetadataKey]

  if (!id) {
    throw failure(
      `a model a snapshot must contain an id (${modelMetadataKey}.id) key, but none was found`
    )
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  return internalNewModel(modelInfo.class as any, undefined, {
    id,
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
      initialData[k] = internalFromSnapshot(v)
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
    plainObj[k] = internalFromSnapshot(v)
  }
  return tweakPlainObject(plainObj, undefined, undefined, true)
}

const observableOptions = {
  deep: false,
}
