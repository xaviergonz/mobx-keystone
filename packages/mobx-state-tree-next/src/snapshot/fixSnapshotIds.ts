import { Writable } from "ts-essentials"
import { v4 as uuidV4 } from "uuid"
import { Model } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import { Ref } from "../ref/Ref"
import { failure, isArray, isMap, isModelSnapshot, isObject, isPlainObject, isSet } from "../utils"
import { isInternalKey, ModelMetadata, modelMetadataKey } from "./metadata"
import { SnapshotInOf } from "./SnapshotOf"

interface FixSnapshotIdsContext {
  idMap: Map<string, string>
  refs: Writable<SnapshotInOf<Ref<any>>>[]
}

export function fixSnapshotIds<T>(sn: T): T {
  const ctx: FixSnapshotIdsContext = {
    idMap: new Map(),
    refs: [],
  }
  const newSn = internalFixSnapshotIds(sn, ctx)

  // update ref ids
  ctx.refs.forEach(ref => {
    ref.id = ctx.idMap.get(ref.id) || ref.id
  })

  return newSn
}

function internalFixSnapshotIds<T>(sn: T, ctx: FixSnapshotIdsContext): T {
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
    return fixArraySnapshotIds(sn, ctx) as any
  }

  if (isModelSnapshot(sn)) {
    return fixModelSnapshotIds(sn, ctx) as any
  }

  if (isPlainObject(sn)) {
    return fixPlainObjectSnapshotIds(sn, ctx) as any
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function fixArraySnapshotIds(sn: any[], ctx: FixSnapshotIdsContext): any[] {
  return sn.map(v => internalFixSnapshotIds(v, ctx))
}

function fixModelSnapshotIds(sn: any, ctx: FixSnapshotIdsContext): Model {
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

  const newId = uuidV4()
  ctx.idMap.set(id, newId)

  const modelSn: any = {
    [modelMetadataKey]: {
      id: newId,
      type,
    },
  }
  for (const [k, v] of Object.entries(sn)) {
    if (!isInternalKey(k)) {
      modelSn[k] = internalFixSnapshotIds(v, ctx)
    }
  }

  if (modelInfo.class === Ref) {
    ctx.refs.push(modelSn)
  }

  return modelSn
}

function fixPlainObjectSnapshotIds(sn: any, ctx: FixSnapshotIdsContext): object {
  const plainObj: any = {}
  for (const [k, v] of Object.entries(sn)) {
    plainObj[k] = internalFixSnapshotIds(v, ctx)
  }
  return plainObj
}
