import { DeepPartial } from "ts-essentials"
import { v4 as uuidV4 } from "uuid"
import { runUnprotected } from "../action"
import { createModelWithUuid, Model } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import { Ref } from "../ref/Ref"
import { failure, isArray, isMap, isModelSnapshot, isObject, isPlainObject, isSet } from "../utils"
import { isInternalKey, modelIdKey, typeofKey } from "./metadata"
import { SnapshotInOf } from "./SnapshotOf"

export interface FromSnapshotOptions {
  generateNewIds?: boolean
}

export function fromSnapshot<T>(
  sn: T extends object ? DeepPartial<SnapshotInOf<T>> : T,
  options?: FromSnapshotOptions
): T {
  return internalFromSnapshot(
    sn,
    {
      generateNewIds: false,
      ...options,
    },
    {
      idMap: new Map(),
    }
  )
}

interface FromSnapshotContext {
  idMap: Map<string, string>
}

function internalFromSnapshot<T>(
  sn: T extends object ? DeepPartial<SnapshotInOf<T>> : T,
  options: FromSnapshotOptions,
  context: FromSnapshotContext
): T {
  if (!isObject(sn)) {
    return sn as any
  }

  if (isMap(sn)) {
    throw failure("a snapshot might not contain maps")
  }

  if (isSet(sn)) {
    throw failure("a snapshot might not contain sets")
  }

  if (isArray(sn)) {
    return fromArraySnapshot(sn, options, context) as any
  }

  if (isModelSnapshot(sn)) {
    return fromModelSnapshot(sn, options, context) as any
  }

  if (isPlainObject(sn)) {
    return fromPlainObjectSnapshot(sn, options, context) as any
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function fromArraySnapshot(
  sn: any[],
  options: FromSnapshotOptions,
  context: FromSnapshotContext
): any[] {
  return sn.map(v => internalFromSnapshot(v, options, context))
}

function fromModelSnapshot(
  sn: any,
  options: FromSnapshotOptions,
  context: FromSnapshotContext
): Model {
  const type = sn[typeofKey]
  const oldId = sn[modelIdKey]

  if (!oldId) {
    throw failure(`a model a snapshot must contain an id (${modelIdKey}) key, but none was found`)
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  let id = oldId
  if (options.generateNewIds) {
    id = uuidV4()
    context.idMap.set(oldId, id)
  }

  const modelObj: Model = createModelWithUuid(modelInfo.class as any, id)
  let processedSn = oldId === id ? sn : { ...sn, [modelIdKey]: id }
  if (modelObj.fromSnapshot) {
    processedSn = modelObj.fromSnapshot(sn) as any
  }

  const data = modelObj.data as any
  runUnprotected(() => {
    for (const [k, v] of Object.entries(processedSn)) {
      if (!isInternalKey(k)) {
        if (options.generateNewIds && modelObj instanceof Ref && k === "id") {
          data.id = context.idMap.get(v as string) || v
        } else {
          data[k] = internalFromSnapshot(v, options, context)
        }
      }
    }
  })

  return modelObj
}

function fromPlainObjectSnapshot(
  sn: any,
  options: FromSnapshotOptions,
  context: FromSnapshotContext
): object {
  const plainObj: any = {}
  for (const [k, v] of Object.entries(sn)) {
    plainObj[k] = internalFromSnapshot(v, options, context)
  }
  return plainObj
}
