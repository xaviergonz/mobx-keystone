import { DeepPartial } from "ts-essentials"
import { runUnprotected } from "../action/protection"
import { frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { isModelInternalKey, ModelMetadata, modelMetadataKey } from "../model/metadata"
import { createModelWithUuid, Model } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import {
  failure,
  isArray,
  isMap,
  isModelSnapshot,
  isPlainObject,
  isPrimitive,
  isSet,
} from "../utils"
import { fixSnapshotIds } from "./fixSnapshotIds"
import { SnapshotInOf } from "./SnapshotOf"

export interface FromSnapshotOptions {
  generateNewIds?: boolean
}

export function fromSnapshot<T>(
  sn: T extends object ? DeepPartial<SnapshotInOf<T>> : T,
  options?: FromSnapshotOptions
): T {
  if (options && options.generateNewIds) {
    sn = fixSnapshotIds(sn)
  }

  return internalFromSnapshot(sn)
}

function internalFromSnapshot<T>(sn: T extends object ? DeepPartial<SnapshotInOf<T>> : T): T {
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

function fromArraySnapshot(sn: any[]): any[] {
  return sn.map(v => internalFromSnapshot(v))
}

function fromModelSnapshot(sn: any): Model {
  const { type, id } = sn[modelMetadataKey] as ModelMetadata

  if (!id) {
    throw failure(
      `a model a snapshot must contain an id (${modelMetadataKey}.id) key, but none was found`
    )
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  const modelObj: Model = createModelWithUuid(modelInfo.class as any, id)
  let processedSn = sn
  if (modelObj.fromSnapshot) {
    processedSn = modelObj.fromSnapshot(sn) as any
  }

  const data = modelObj.data as any
  runUnprotected(() => {
    for (const [k, v] of Object.entries(processedSn)) {
      if (!isModelInternalKey(k)) {
        data[k] = internalFromSnapshot(v)
      }
    }
  })

  return modelObj
}

function fromPlainObjectSnapshot(sn: any): object {
  const plainObj: any = {}
  for (const [k, v] of Object.entries(sn)) {
    plainObj[k] = internalFromSnapshot(v)
  }
  return plainObj
}
