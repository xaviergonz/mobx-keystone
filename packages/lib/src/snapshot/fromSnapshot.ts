import { frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { isReservedModelKey, modelMetadataKey } from "../model/metadata"
import { AnyModel, internalNewModel } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import { isModelSnapshot } from "../model/utils"
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
   * If set to true (the default) then Models will have brand new IDs, and
   * references will fix their target IDs accordingly.
   */
  generateNewIds?: boolean
}

/**
 * Deserializers a data structure from its snapshot form.
 * If options has `generateNewIds` set to true (the default) then Models will have brand new IDs, and
 * references will fix their target IDs accordingly.
 *
 * @typeparam T Object type.
 * @param sn Snapshot, including primitives.
 * @param [options] Options.
 * @returns The deserialized object.
 */
export function fromSnapshot<T>(sn: SnapshotInOf<T>, options?: FromSnapshotOptions): T {
  if (options && options.generateNewIds) {
    sn = fixSnapshotIds(sn)
  }

  return internalFromSnapshot(sn)
}

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
  return sn.map(v => internalFromSnapshot(v))
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
  const initialData: any = {}
  for (const [k, v] of Object.entries(processedSn)) {
    if (!isReservedModelKey(k)) {
      initialData[k] = internalFromSnapshot(v)
    }
  }
  return initialData
}

function fromPlainObjectSnapshot(sn: SnapshotInOfObject<any>): object {
  const plainObj: any = {}
  for (const [k, v] of Object.entries(sn)) {
    plainObj[k] = internalFromSnapshot(v)
  }
  return plainObj
}
